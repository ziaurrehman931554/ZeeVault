import { SubtitleFormat, SubtitleSearchResult } from '../types/index';

const SUBDL_API_BASE = 'https://api.subdl.com';
const OPENSUBTITLES_API_BASE = 'https://api.opensubtitles.com/api/v1';

// Built-in default keys so subtitles work out of the box.
// These can be overridden via localStorage (see ApiKeySettings / setApiKeys).
const DEFAULT_OPENSUBTITLES_KEY = 'jdltQsZTcVKqIWp0zquw1jjzN7eyIVDk';
const DEFAULT_SUBDL_KEY = 'subdl_hkSS0nwSTB9Mc03VZYRpw2p9i_uAPyu0A9RQzPyXKc4';

function getSubdlKey(): string {
  try { return localStorage.getItem('zeevault-subdl-key') || DEFAULT_SUBDL_KEY; } catch { return DEFAULT_SUBDL_KEY; }
}

function getOpensubtitlesKey(): string {
  try { return localStorage.getItem('zeevault-opensubtitles-key') || DEFAULT_OPENSUBTITLES_KEY; } catch { return DEFAULT_OPENSUBTITLES_KEY; }
}

export function setApiKeys(osKey: string, subdlKey: string): void {
  try {
    if (osKey) localStorage.setItem('zeevault-opensubtitles-key', osKey);
    else localStorage.removeItem('zeevault-opensubtitles-key');
    if (subdlKey) localStorage.setItem('zeevault-subdl-key', subdlKey);
    else localStorage.removeItem('zeevault-subdl-key');
  } catch {}
}

export function getApiKeys(): { opensubtitles: string; subdl: string } {
  return { opensubtitles: getOpensubtitlesKey(), subdl: getSubdlKey() };
}

function detectFormat(name: string): SubtitleFormat {
  const lower = name.toLowerCase();
  if (lower.endsWith('.ass')) return 'ass';
  if (lower.endsWith('.ssa')) return 'ssa';
  if (lower.endsWith('.vtt')) return 'vtt';
  if (lower.endsWith('.sub')) return 'sub';
  return 'srt';
}

function cleanSearchQuery(videoName: string): string {
  let q = videoName;
  const ext = q.split('.').pop()?.toLowerCase() || '';
  if (['mp4', 'mkv', 'avi', 'mov', 'webm', 'wmv', 'm4v', 'ts', 'flv', 'mpg', 'mpeg', 'ogv', '3gp'].includes(ext)) {
    q = q.substring(0, q.lastIndexOf('.'));
  }
  q = q.replace(/\b(1080p|720p|480p|4k|2160p|bluray|brrip|webrip|webdl|hdtv|dvdrip|hdcam|cam|ts|hdrip|proper|repack|internal|limited|unrated|extended|directors?\.?cut)\b/gi, '');
  q = q.replace(/[.\-_]/g, ' ').replace(/\s+/g, ' ').trim();
  const yearMatch = q.match(/\b(19|20)\d{2}\b/);
  if (yearMatch) {
    const title = q.substring(0, q.indexOf(yearMatch[0])).trim();
    const year = yearMatch[0];
    const after = q.substring(q.indexOf(year) + 4).trim();
    q = after ? `${title} ${year} ${after}` : `${title} ${year}`;
  }
  return q.trim();
}

function scoreResult(result: SubtitleSearchResult, query: string): number {
  let score = 0;
  const q = query.toLowerCase();
  const name = result.releaseName.toLowerCase();
  if (name.includes(q)) score += 50;
  const words = q.split(/\s+/);
  for (const w of words) {
    if (w.length > 2 && name.includes(w)) score += 10;
  }
  if (result.downloadCount && result.downloadCount > 100) score += 15;
  else if (result.downloadCount && result.downloadCount > 10) score += 8;
  if (result.format === 'srt') score += 5;
  return score;
}

async function searchOpenSubtitles(query: string, language?: string): Promise<SubtitleSearchResult[]> {
  const apiKey = getOpensubtitlesKey();
  if (!apiKey) return [];

  try {
    const params = new URLSearchParams({
      query,
      per_page: '20',
      order_by: 'download_count',
      order_direction: 'desc',
    });
    if (language && language !== 'all') {
      params.set('languages', language);
    }

    const response = await fetch(`${OPENSUBTITLES_API_BASE}/subtitles?${params}`, {
      headers: {
        'Api-Key': apiKey,
        'Content-Type': 'application/json',
        'User-Agent': 'ZeeVault v1.0.0',
      },
    });

    if (!response.ok) {
      console.warn(`[OpenSubtitles] API returned ${response.status}`);
      return [];
    }

    const data = await response.json();
    if (!data.data || !Array.isArray(data.data)) return [];

    return data.data.map((item: any): SubtitleSearchResult => {
      const attrs = item.attributes || {};
      const file = attrs.files?.[0] || {};
      const lang = attrs.language || 'Unknown';
      const langCode = attrs.language_code || 'en';
      const format = detectFormat(file.file_name || '');

      return {
        id: `os-${item.id}`,
        releaseName: file.file_name || attrs.release_name || 'Unknown',
        fileName: file.file_name || '',
        language: lang,
        languageCode: langCode,
        format,
        uploader: attrs.uploader?.name || attrs.uploader_name || 'Unknown',
        downloadCount: attrs.download_count ?? 0,
        source: 'opensubtitles',
        downloadUrl: '',
        matchScore: 0,
      };
    });
  } catch (err) {
    console.error('[OpenSubtitles] Search failed:', err);
    return [];
  }
}

async function searchSubdl(query: string, language?: string): Promise<SubtitleSearchResult[]> {
  const apiKey = getSubdlKey();
  if (!apiKey) return [];

  try {
    const params = new URLSearchParams({
      film_name: query,
      type: 'movie',
    });
    if (language && language !== 'all') {
      params.set('languages', language.toUpperCase());
    }

    const response = await fetch(`${SUBDL_API_BASE}/api/v2/subtitles/search?${params}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(`[SubDL] API returned ${response.status}`);
      return [];
    }

    const data = await response.json();
    if (!data.subtitles || !Array.isArray(data.subtitles)) return [];

    return data.subtitles.map((item: any): SubtitleSearchResult => {
      const format = detectFormat(item.name || item.release_name || '');
      const lang = item.lang || 'Unknown';

      return {
        id: `sd-${item.url || Math.random().toString(36).slice(2)}`,
        releaseName: item.release_name || item.name || 'Unknown',
        fileName: item.name || '',
        language: lang.charAt(0).toUpperCase() + lang.slice(1),
        languageCode: item.lang?.toLowerCase().substring(0, 2) || 'en',
        format,
        uploader: item.author || 'Unknown',
        downloadCount: undefined,
        source: 'subdl',
        downloadUrl: item.download_link || '',
        matchScore: 0,
      };
    });
  } catch (err) {
    console.error('[SubDL] Search failed:', err);
    return [];
  }
}

async function downloadFromOpenSubtitles(fileId: string): Promise<string | null> {
  const apiKey = getOpensubtitlesKey();
  if (!apiKey) return null;

  try {
    const response = await fetch(`${OPENSUBTITLES_API_BASE}/download`, {
      method: 'POST',
      headers: {
        'Api-Key': apiKey,
        'Content-Type': 'application/json',
        'User-Agent': 'ZeeVault v1.0.0',
      },
      body: JSON.stringify({ file_id: parseInt(fileId.replace('os-', '')) }),
    });

    if (!response.ok) {
      console.warn(`[OpenSubtitles] Download failed: ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (data.link) {
      const subResponse = await fetch(data.link);
      if (subResponse.ok) {
        return await subResponse.text();
      }
    }
    return null;
  } catch (err) {
    console.error('[OpenSubtitles] Download failed:', err);
    return null;
  }
}

async function downloadFromSubdl(downloadUrl: string): Promise<string | null> {
  try {
    const response = await fetch(downloadUrl);
    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/zip') || contentType.includes('application/octet-stream')) {
      const buffer = await response.arrayBuffer();
      return await extractSrtFromZip(new Uint8Array(buffer));
    }

    return await response.text();
  } catch (err) {
    console.error('[SubDL] Download failed:', err);
    return null;
  }
}

async function extractSrtFromZip(zipBuffer: Uint8Array): Promise<string | null> {
  const str = new TextDecoder('latin1').decode(zipBuffer);
  const srtMatch = str.match(/[\x20-\x7E\s]{50,}/);
  if (srtMatch && srtMatch[0].includes('-->')) {
    return srtMatch[0];
  }

  const utf8Str = new TextDecoder('utf-8').decode(zipBuffer);
  const srtMatch2 = utf8Str.match(/[\x20-\x7E\s]{50,}/);
  if (srtMatch2 && srtMatch2[0].includes('-->')) {
    return srtMatch2[0];
  }

  return null;
}

function convertSrtToVtt(srtContent: string): string {
  let vtt = 'WEBVTT\n\n';
  const lines = srtContent.replace(/\r\n/g, '\n').split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    if (line.includes('-->')) {
      const timeLine = line.replace(/,/g, '.');
      vtt += timeLine + '\n';
      i++;
      while (i < lines.length && lines[i].trim() !== '') {
        vtt += lines[i] + '\n';
        i++;
      }
      vtt += '\n';
    }
    i++;
  }

  return vtt;
}

function convertAssToVtt(assContent: string): string {
  let vtt = 'WEBVTT\n\n';
  const lines = assContent.replace(/\r\n/g, '\n').split('\n');

  for (const line of lines) {
    if (line.startsWith('Dialogue:')) {
      const parts = line.substring(9).split(',');
      if (parts.length >= 10) {
        const start = parts[1].trim();
        const end = parts[2].trim();
        const text = parts.slice(9).join(',').replace(/\{[^}]*\}/g, '').replace(/\\N/g, '\n').replace(/\\n/g, '\n').trim();

        const convertTime = (t: string) => {
          const match = t.match(/(\d+):(\d+):(\d+)\.(\d+)/);
          if (match) {
            const [, h, m, s, cs] = match;
            return `${h.padStart(2, '0')}:${m.padStart(2, '0')}:${s.padStart(2, '0')}.${cs.padEnd(3, '0').substring(0, 3)}`;
          }
          return t;
        };

        vtt += `${convertTime(start)} --> ${convertTime(end)}\n${text}\n\n`;
      }
    }
  }

  return vtt;
}

export function parseSrtToCues(srtContent: string): Array<{ start: number; end: number; text: string }> {
  const cues: Array<{ start: number; end: number; text: string }> = [];
  const blocks = srtContent.replace(/\r\n/g, '\n').split('\n\n');

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 2) continue;

    let timeLineIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('-->')) {
        timeLineIndex = i;
        break;
      }
    }

    if (timeLineIndex === -1) continue;

    const timeLine = lines[timeLineIndex];
    const timeParts = timeLine.split('-->');
    if (timeParts.length !== 2) continue;

    const parseTime = (t: string): number => {
      const trimmed = t.trim();
      const match = trimmed.match(/(\d+):(\d+):(\d+)[,.](\d+)/);
      if (match) {
        const [, h, m, s, ms] = match;
        return parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s) + parseInt(ms.padEnd(3, '0').substring(0, 3)) / 1000;
      }
      const match2 = trimmed.match(/(\d+):(\d+)[,.](\d+)/);
      if (match2) {
        const [, m, s, ms] = match2;
        return parseInt(m) * 60 + parseInt(s) + parseInt(ms.padEnd(3, '0').substring(0, 3)) / 1000;
      }
      return 0;
    };

    const start = parseTime(timeParts[0]);
    const end = parseTime(timeParts[1]);
    const text = lines.slice(timeLineIndex + 1).join('\n').trim();

    if (text) {
      cues.push({ start, end, text: text.replace(/<[^>]*>/g, '') });
    }
  }

  return cues;
}

export async function searchSubtitles(
  videoName: string,
  language: string = 'all',
  preferredSource: 'opensubtitles' | 'subdl' = 'opensubtitles'
): Promise<SubtitleSearchResult[]> {
  const query = cleanSearchQuery(videoName);
  if (!query) return [];

  let results: SubtitleSearchResult[] = [];

  if (preferredSource === 'opensubtitles') {
    results = await searchOpenSubtitles(query, language);
    if (results.length === 0) {
      results = await searchSubdl(query, language);
    }
  } else {
    results = await searchSubdl(query, language);
    if (results.length === 0) {
      results = await searchOpenSubtitles(query, language);
    }
  }

  for (const r of results) {
    r.matchScore = scoreResult(r, query);
  }

  results.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));

  return results;
}

export async function downloadSubtitle(result: SubtitleSearchResult): Promise<{ vttUrl: string; format: SubtitleFormat } | null> {
  let srtContent: string | null = null;

  if (result.source === 'opensubtitles') {
    const rawFileId = result.id.replace('os-', '');
    srtContent = await downloadFromOpenSubtitles(rawFileId);
  } else if (result.source === 'subdl' && result.downloadUrl) {
    srtContent = await downloadFromSubdl(result.downloadUrl);
  }

  if (!srtContent) return null;

  let vttContent: string;
  const format = result.format;

  if (format === 'vtt') {
    vttContent = srtContent;
  } else if (format === 'ass' || format === 'ssa') {
    vttContent = convertAssToVtt(srtContent);
  } else {
    vttContent = convertSrtToVtt(srtContent);
  }

  const blob = new Blob([vttContent], { type: 'text/vtt' });
  const vttUrl = URL.createObjectURL(blob);

  return { vttUrl, format: 'vtt' };
}

export function buildVideoSearchQuery(videoName: string): string {
  return cleanSearchQuery(videoName);
}
