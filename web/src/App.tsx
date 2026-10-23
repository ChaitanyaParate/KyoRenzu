import { useState, useEffect, useRef } from 'react'
import { Sparkles, Music, BookOpen, Star, Search, Image as ImageIcon, Home, Library, Bell, Menu, Play, Info, X, Type, Hash, CalendarRange, Tv, MonitorPlay, ArrowDownWideNarrow, Filter, FilterX, Building2, Globe, Download, Upload, Shuffle, Users, User, Compass, AlertCircle, LayoutGrid, List, BarChart2, RefreshCw, CheckSquare, Square, Trash2, Check, Palette, Sliders, Dices, Target, Plus, Tags } from 'lucide-react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import './index.css'

export const THEMES = [
  { id: 'azure', name: 'Obsidian Azure', category: 'Default • Cyber Shonen', primary: '#00A3FF', secondary: '#FF2A85', bg: '#07080B' },
  { id: 'cyberpunk', name: 'Cyberpunk Syndicate', category: 'Neo-Tokyo Nightscape', primary: '#B026FF', secondary: '#FFDE59', bg: '#08060E' },
  { id: 'emerald', name: 'Emerald Kodama', category: 'Studio Ghibli Mystic', primary: '#00E5A3', secondary: '#F59E0B', bg: '#050B08' },
  { id: 'crimson', name: 'Blood Moon Crimson', category: 'Dark Gothic Fantasy', primary: '#FF2E56', secondary: '#A855F7', bg: '#0A0607' },
  { id: 'sunset', name: 'Sunset Mirage', category: '80s City Pop & Lo-Fi', primary: '#FF6B4A', secondary: '#A78BFA', bg: '#0A070D' },
  { id: 'titanium', name: 'Ghost Titanium', category: 'Tactical Stealth Mecha', primary: '#38BDF8', secondary: '#FB923C', bg: '#08090A' },
  { id: 'solar', name: 'Solar Flare', category: 'Super Saiyan Gold', primary: '#F59E0B', secondary: '#EF4444', bg: '#0B0804' },
  { id: 'vaporwave', name: 'Neo Tokyo Synth', category: 'Retrowave Pastel Neon', primary: '#EC4899', secondary: '#14B8A6', bg: '#09060E' },
  { id: 'amethyst', name: 'Abyssal Amethyst', category: 'Cursed Sorcery Void', primary: '#8B5CF6', secondary: '#06B6D4', bg: '#08050D' },
  { id: 'sakura', name: 'Neon Sakura Bloom', category: 'Spring Hanami Dream', primary: '#F472B6', secondary: '#38BDF8', bg: '#0A060A' },
  { id: 'arctic', name: 'Bifrost Arctic', category: 'Glacial Aurora Borealis', primary: '#38E1FF', secondary: '#818CF8', bg: '#05090F' },
  { id: 'inferno', name: "Dragon's Inferno", category: 'Molten Dragon Flame', primary: '#FF5722', secondary: '#FBBF24', bg: '#0B0604' },
] as const;
export type ThemeId = typeof THEMES[number]['id'];

export const THEME_CHART_COLORS: Record<string, string[]> = {
  azure: ['#00A3FF', '#38BDF8', '#FF2A85', '#0284C7', '#7DD3FC', '#FF66AA', '#0369A1', '#D60058'],
  cyberpunk: ['#B026FF', '#D946EF', '#FFDE59', '#9333EA', '#FACC15', '#A855F7', '#EAB308', '#7E22CE'],
  emerald: ['#00E5A3', '#34D399', '#F59E0B', '#059669', '#FBBF24', '#10B981', '#D97706', '#047857'],
  crimson: ['#FF2E56', '#FB7185', '#A855F7', '#E11D48', '#C084FC', '#BE123C', '#9333EA', '#881337'],
  sunset: ['#FF6B4A', '#FB923C', '#A78BFA', '#F97316', '#C4B5FD', '#EA580C', '#8B5CF6', '#C2410C'],
  titanium: ['#38BDF8', '#60A5FA', '#FB923C', '#0284C7', '#FDBA74', '#0369A1', '#EA580C', '#075985'],
  solar: ['#F59E0B', '#FBBF24', '#EF4444', '#D97706', '#F87171', '#B45309', '#DC2626', '#92400E'],
  vaporwave: ['#EC4899', '#F472B6', '#14B8A6', '#DB2777', '#2DD4BF', '#BE185D', '#0D9488', '#9D174D'],
  amethyst: ['#8B5CF6', '#A78BFA', '#06B6D4', '#7C3AED', '#22D3EE', '#6D28D9', '#0891B2', '#5B21B6'],
  sakura: ['#F472B6', '#F9A8D4', '#38BDF8', '#EC4899', '#7DD3FC', '#DB2777', '#0284C7', '#BE185D'],
  arctic: ['#38E1FF', '#7DD3FC', '#818CF8', '#0284C7', '#A5B4FC', '#0369A1', '#6366F1', '#075985'],
  inferno: ['#FF5722', '#FF7043', '#FBBF24', '#E64A19', '#FCD34D', '#D84315', '#F59E0B', '#BF360C'],
};

export const getTasteBadgeTierClass = (pct: number) => {
  if (pct >= 85) return 'tier-high';
  if (pct >= 70) return 'tier-mid';
  return 'tier-subtle';
};

const getInitialApiBase = () => {
  if (typeof window !== 'undefined') {
    const w = window as any;
    if (w.__KYORENZU_API_BASE__) return w.__KYORENZU_API_BASE__;
    const urlParams = new URLSearchParams(window.location.search);
    const qPort = urlParams.get('port');
    const port = w.__KYORENZU_PORT__ || qPort || '8000';
    return `http://localhost:${port}`;
  }
  return 'http://localhost:8000';
};

export const API_BASE = getInitialApiBase();

export const resolveMediaUrl = (url?: string | null) => {
  if (!url) return '';
  if (url.startsWith('http://localhost:8000/')) {
    return url.replace('http://localhost:8000', API_BASE);
  }
  return url;
};
export const computeCacheEpoch = (): string => {
  const epochMin = Math.floor(Date.now() / 60000);
  let hash = 0x811c9dc5;
  const str = `${epochMin}_0x43504B52`;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

if (typeof window !== 'undefined' && !(window as any).__cacheEpochPatched) {
  (window as any).__cacheEpochPatched = true;
  const origFetch = window.fetch;
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const epoch = computeCacheEpoch();
    if (!init) {
      init = { headers: { 'X-Cache-Epoch': epoch } };
    } else {
      init.headers = {
        ...(init.headers || {}),
        'X-Cache-Epoch': epoch,
      };
    }
    return origFetch(input, init);
  };
}

interface AnimeRecommendation {
  mal_id?: number
  rank?: number
  title: string
  title_original?: string
  title_english?: string
  score: number | null
  members?: number
  genres: string | null
  synopsis?: string | null
  year?: number | null | string
  episodes?: number | null
  similarity?: number
  visual_similarity?: number | null
  plot_similarity?: number | null
  audio_similarity?: number | null
  match_reason?: string | null
  cover_url: string | null
  theme_url?: string | null
}

export const QUICK_ANCHOR_SUGGESTIONS = [
  'Cowboy Bebop',
  'Steins;Gate',
  'Cyberpunk: Edgerunners',
  'Frieren: Beyond Journey\'s End',
  'Monster',
  'Akira',
];

export const GENRE_CHIPS = [
  'Action',
  'Sci-Fi',
  'Psychological',
  'Fantasy',
  'Romance',
  'Mystery',
  'Cyberpunk',
  'Slice of Life',
];
export const VISUAL_CHIPS = GENRE_CHIPS;

export const PLOT_CHIPS = [
  'Time Loop',
  'Psychological Mind Games',
  'Space Bounty Hunters',
  'Found Family',
];

export const AUDIO_CHIPS = [
  'Smooth Jazz',
  'Synthwave Electronic',
  'Melancholic Piano',
  'Lo-Fi City Pop',
];

export const ERA_PRESETS = [
  { label: 'Any Era', value: '' },
  { label: '80s/90s Retro', value: '1995' },
  { label: '2000s Classic', value: '2006' },
  { label: '2010s', value: '2015' },
  { label: '2020s Modern', value: '2023' },
];

export const RESULT_COUNT_PRESETS = [12, 24, 36, 48];

export interface CustomPreset {
  id: string;
  title: string;
  badge: string;
  description: string;
  visual: string;
  plot: string;
  audio: string;
  era: string;
  positiveSeeds: string[];
  negativeSeeds: string[];
  visualWeight?: number;
  plotWeight?: number;
  audioWeight?: number;
  diversityLambda?: number;
  minScore?: number;
  format?: string;
}

export const CURATED_AESTHETICS = [
  {
    title: 'Neo-Tokyo Cyberpunk',
    badge: 'Sci-Fi • Dystopian',
    description: 'Holographic rain, gritty alleyways, cybernetic corporate intrigue and analog synthwave.',
    visual: 'Cyberpunk Neon, holographic rain, gritty urban alleyways',
    plot: 'High-tech corporate espionage and cybernetic bounty hunters',
    audio: 'Synthwave Electronic, pulsing bass and analog synthesizers',
    era: '2022',
    anchor: 'Cyberpunk: Edgerunners, Akira',
  },
  {
    title: 'Ghibli Kodama Reverie',
    badge: 'Spiritual • Nature',
    description: 'Lush hand-painted forests, ancient nature spirits, gentle pastoral journey and nostalgic piano.',
    visual: 'Watercolor Pastel, lush green ancient forests, hand-painted skies',
    plot: 'Ancient forest spirits, gentle pastoral journey and healing',
    audio: 'Melancholic Piano, orchestral woodwinds and nostalgic strings',
    era: '',
    anchor: 'Princess Mononoke, Spirited Away',
  },
  {
    title: 'Dark Gothic Blood Moon',
    badge: 'Occult • Psychological',
    description: 'Victorian shadows, cursed vampires, dark pacts and operatic choral pipe organ darkwave.',
    visual: 'Dark Neo-Noir, Victorian shadows, crimson moonlight, gothic architecture',
    plot: 'Occult Detective, cursed vampires, psychological torment and dark pacts',
    audio: 'Orchestral Choir, pipe organ and operatic gothic darkwave',
    era: '2006',
    anchor: 'Hellsing Ultimate, Death Note',
  },
  {
    title: '80s City Pop Sunset',
    badge: 'Retro • Romance',
    description: 'Sunset convertible highway drives, seaside romance, and upbeat Rhodes chord grooves.',
    visual: '90s Cel Grain, sunset highway, retro convertible, warm pastel twilight',
    plot: 'Youthful summer love, seaside dreams and bittersweet farewells',
    audio: 'Lo-Fi City Pop, upbeat brass, slap bass and dreamy Rhodes chords',
    era: '1989',
    anchor: 'Kimagure Orange Road, City Hunter',
  },
  {
    title: 'Space Western Bebop',
    badge: 'Bebop • Adventure',
    description: 'Smoky neon interplanetary bars, ragtag bounty hunters, and acoustic blues harmonica jazz.',
    visual: 'Retro spaceship interiors, smoky neon bars, dusty planetary outposts',
    plot: 'Space Bounty Hunters, ragtag crew drifting across the solar system',
    audio: 'Smooth Jazz Sax, upbeat acoustic jazz and blues harmonica',
    era: '1998',
    anchor: 'Cowboy Bebop, Trigun',
  },
  {
    title: 'Psychological Paranoia',
    badge: 'Mind Games • Thriller',
    description: 'Liminal corridors, existential dread, serial investigation and discordant violin strings.',
    visual: 'Desaturated patterns, fractured reflections, liminal hospital corridors',
    plot: 'Psychological Mind Games, serial killer investigation and existential dread',
    audio: 'Ambient drone, discordant violin and heart-pounding tension strings',
    era: '2004',
    anchor: 'Monster, Paranoia Agent',
  },
  {
    title: 'Shonen Sakuga Ascent',
    badge: 'Action • High Stakes',
    description: 'Ufotable glow particle bursts, relentless willpower, and roaring anthemic electric J-Rock.',
    visual: 'Ufotable Glow, high-octane particle effects, dynamic kinetic perspective',
    plot: 'Overcoming insurmountable odds through relentless training and willpower',
    audio: 'High-Octane J-Rock, roaring electric guitar and anthemic drums',
    era: '2019',
    anchor: 'Demon Slayer: Kimetsu no Yaiba, Jujutsu Kaisen',
  },
  {
    title: 'Hanami Nostalgia',
    badge: 'Slice of Life • Romance',
    description: 'Makoto Shinkai skies, fluttering cherry petals, time loop youth and emotive acoustic strings.',
    visual: 'Makoto Shinkai Skies, fluttering cherry blossom petals, luminous lens flare',
    plot: 'Time Loop Mystery, bittersweet youth and enduring emotional connections',
    audio: 'Melancholic Piano, gentle acoustic guitar and warm emotive strings',
    era: '2016',
    anchor: 'Your Name., A Silent Voice',
  },
];

interface CategoryRow {
  category: string
  anime: AnimeRecommendation[]
}

const cleanSynopsis = (text?: string | null) => {
  if (!text) return "No synopsis available."
  return text
    .replace(/\[Written by MAL Rewrite\]/gi, '')
    .trim()
}

function levenshtein(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, () => 
    new Array(b.length + 1).fill(0)
  );
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  return matrix[a.length][b.length];
}

function fuzzyMatchTitle(query: string, title1?: string | null, title2?: string | null): boolean {
  if (!query) return true;
  query = query.toLowerCase();
  
  const checkTitle = (t?: string | null) => {
    if (!t) return false;
    t = t.toLowerCase();
    if (t.includes(query)) return true;
    
    // Normalize: replace punctuation with spaces
    const normalize = (str: string) => str.replace(/[^\w\s]/g, ' ').trim();
    
    const qWords = normalize(query).split(/\s+/).filter(w => w.length > 0);
    const tWords = normalize(t).split(/\s+/).filter(w => w.length > 0);
    
    if (qWords.length === 0) return true;

    for (let qWord of qWords) {
      let wordMatched = false;
      for (let tWord of tWords) {
        if (tWord.includes(qWord)) {
          wordMatched = true;
          break;
        }
        if (qWord.length > 3 && tWord.length > 3 && levenshtein(qWord, tWord) <= 1) {
          wordMatched = true;
          break;
        }
        if (qWord.length > 6 && tWord.length > 6 && levenshtein(qWord, tWord) <= 2) {
          wordMatched = true;
          break;
        }
      }
      if (!wordMatched) return false;
    }
    return true;
  };
  
  return checkTitle(title1) || checkTitle(title2);
}

function App() {
  const [activeTab, setActiveTab] = useState('home')
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false)
  const [userName, setUserName] = useState<string>(localStorage.getItem('kyorenzu_username') || '')
  const [episodePage, setEpisodePage] = useState(0)

  // Theme State & Persistence (Default: Obsidian Azure)
  const [theme, setTheme] = useState<ThemeId>(() => {
    try {
      // Purge legacy key to prevent stale theme leakages
      localStorage.removeItem('kyorenzu_theme');
      const explicit = localStorage.getItem('kyorenzu_color_theme');
      if (explicit === 'sunset' || explicit === 'crimson') {
        localStorage.removeItem('kyorenzu_color_theme');
      } else if (explicit) {
        const found = THEMES.find(t => t.id === explicit);
        if (found) return found.id as ThemeId;
      }
    } catch (e) {}
    return 'azure'; // Obsidian Azure is ALWAYS the default!
  });
  const [showThemeModal, setShowThemeModal] = useState(false);

  // Synchronize active theme with DOM, localStorage, and persistent SQLite backend
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('kyorenzu_color_theme', theme);
    } catch (e) {}

    // Persist to backend database so it remains across AppImage & web reboots
    fetch(`${API_BASE}/api/settings/theme`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme }),
    }).catch(() => {});
  }, [theme]);

  // On initial mount, query the backend database for any saved theme across sessions
  useEffect(() => {
    fetch(`${API_BASE}/api/settings/theme`)
      .then(res => res.json())
      .then(data => {
        if (data && data.theme) {
          const valid = THEMES.some(t => t.id === data.theme);
          if (valid) {
            setTheme(data.theme as ThemeId);
            document.documentElement.setAttribute('data-theme', data.theme);
            try {
              localStorage.setItem('kyorenzu_color_theme', data.theme);
            } catch (e) {}
          }
        }
      })
      .catch(() => {});
  }, []);

  // Notifications State
  const [notifications, setNotifications] = useState<any[]>([])
  const [showNotifications, setShowNotifications] = useState(false)
  const unreadCount = notifications.filter(n => !n.is_read).length

  // OTA Status State
  interface OtaStatus {
    status: 'idle' | 'running' | 'completed' | 'error'
    message: string
    last_sync: string | null
    synced_count: number
    embedded_count: number
    error: string | null
  }
  const [otaStatus, setOtaStatus] = useState<OtaStatus>({
    status: 'idle',
    message: 'OTA catalog up to date',
    last_sync: null,
    synced_count: 0,
    embedded_count: 0,
    error: null,
  })
  const [isSyncingOta, setIsSyncingOta] = useState(false)
  
  // Library State
  const [libraryLoading, setLibraryLoading] = useState(true)
  const [heroAnimes, setHeroAnimes] = useState<AnimeRecommendation[]>([])
  const [currentHeroIndex, setCurrentHeroIndex] = useState(0)
  const [topAnimeTab, setTopAnimeTab] = useState('Day')
  const [categories, setCategories] = useState<CategoryRow[]>([])
  
  // Details Modal State
  const [selectedAnime, setSelectedAnime] = useState<any | null>(null)
  const [dynamicEpisodes, setDynamicEpisodes] = useState<number | null>(null)
  const [modalRecommendations, setModalRecommendations] = useState<any[]>([])
  
  // Video Player State
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [isDub, setIsDub] = useState(false)
  const [quality, setQuality] = useState('best')
  const [provider, setProvider] = useState('anidb')
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // User Library State
  const [userLibrary, setUserLibrary] = useState<any[]>([])
  const [userLibraryLoading, setUserLibraryLoading] = useState(false)
  const [userLibraryStatusFilter, setUserLibraryStatusFilter] = useState('All')
  const [libraryPage, setLibraryPage] = useState(1);
  const LIBRARY_ITEMS_PER_PAGE = 48; // Good for both 4-col and 6-col grids
  const [librarySearch, setLibrarySearch] = useState('')
  const [libraryGenre, setLibraryGenre] = useState('')
  const [librarySort, setLibrarySort] = useState('updated_desc')
  const [libraryViewMode, setLibraryViewMode] = useState<'list'|'grid'>('list')
  const [librarySeason, setLibrarySeason] = useState('')
  const [libraryYear, setLibraryYear] = useState('')
  const [libraryScore, setLibraryScore] = useState('')
  const [libraryScoreCondition, setLibraryScoreCondition] = useState('>=')
  const [libraryFavoritesOnly, setLibraryFavoritesOnly] = useState(false)
  const [isBatchMode, setIsBatchMode] = useState(false)
  const [selectedMalIds, setSelectedMalIds] = useState<number[]>([])
  const [libraryInsights, setLibraryInsights] = useState<any | null>(null)
  const [isLoadingInsights, setIsLoadingInsights] = useState(false)
  const debounceTimers = useRef<Map<number, any>>(new Map())
  const pendingTargetEpisodes = useRef<Map<number, number>>(new Map())

  useEffect(() => {
    return () => {
      debounceTimers.current.forEach(timer => clearTimeout(timer))
    }
  }, [])

  const [importFile, setImportFile] = useState<File | null>(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [showUniqueModal, setShowUniqueModal] = useState(false)
  const [showStatsModal, setShowStatsModal] = useState(false)
  const [uniqueCount, setUniqueCount] = useState(0)
  const [moviesCount, setMoviesCount] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const calculateUniqueAnime = () => {
    const bases = new Set();
    let movies = 0;
    userLibrary.filter(item => item.status === 'Completed').forEach(item => {
      if (item.total_episodes === 1) {
        movies++;
      } else {
        let title = item.title.toLowerCase();
        title = title.replace(/season \d+/g, '')
                     .replace(/part \d+/g, '')
                     .replace(/\d+nd season/g, '')
                     .replace(/\d+rd season/g, '')
                     .replace(/\d+th season/g, '')
                     .replace(/the final season/g, '')
                     .split(':')[0] 
                     .trim();
        bases.add(title);
      }
    });
    setUniqueCount(bases.size);
    setMoviesCount(movies);
    setShowUniqueModal(true);
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }
  useEffect(() => {
    setEpisodePage(0)
  }, [selectedAnime])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setImportFile(e.dataTransfer.files[0])
    }
  }

  const handleImportChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setImportFile(e.target.files[0])
    }
    e.target.value = ''
  }

  const processImport = async (overwrite: boolean) => {
    if (!importFile) return
    const formData = new FormData()
    formData.append('file', importFile)
    formData.append('overwrite', overwrite ? 'true' : 'false')

    try {
      const res = await fetch(`${API_BASE}/api/library/import`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (data.status === 'success') {
        alert(`Successfully imported ${data.imported} items!`)
        fetchUserLibrary()
      } else {
        alert(`Import failed: ${data.detail}`)
      }
    } catch (err) {
      alert(`Error during import: ${err}`)
    } finally {
      setImportFile(null)
      setShowImportModal(false)
    }
  }

  useEffect(() => {
    if ((activeTab === 'library' || activeTab === 'discover') && userLibrary.length === 0) {
      fetchUserLibrary()
    }
  }, [activeTab])

  async function fetchUserLibrary() {
    setUserLibraryLoading(true)
    try {
      const response = await fetch(`${API_BASE}/api/user_library`)
      const data = await response.json()
      if (data.status === 'success') {
        setUserLibrary(data.library || [])
      }
    } catch (err) {
      console.error("Failed to load user library:", err)
    } finally {
      setUserLibraryLoading(false)
    }
  }

  const fetchLibraryInsights = async () => {
    setIsLoadingInsights(true)
    try {
      const response = await fetch(`${API_BASE}/api/user_library/insights`)
      const data = await response.json()
      if (data.status === 'success') {
        setLibraryInsights(data)
      }
    } catch (err) {
      console.error("Failed to load library insights:", err)
    } finally {
      setIsLoadingInsights(false)
    }
  }

  useEffect(() => {
    if (showStatsModal) {
      fetchLibraryInsights()
    }
  }, [showStatsModal])
  
  // Search View State
  const [searchQuery, setSearchQuery] = useState('')
  const [searchGenres, setSearchGenres] = useState<string[]>([])
  const [searchSeason, setSearchSeason] = useState('')
  const [searchYear, setSearchYear] = useState('')
  const [searchFormat, setSearchFormat] = useState('')
  const [searchStatus, setSearchStatus] = useState('')
  const [searchSort, setSearchSort] = useState('trending')
  const [searchResults, setSearchResults] = useState<AnimeRecommendation[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchPage, setSearchPage] = useState(1)
  const [hasMoreSearch, setHasMoreSearch] = useState(true)

  // Debounced Search Effect
  useEffect(() => {
    if (activeTab === 'search') {
      const delayFn = setTimeout(() => {
        executeSearch(1, true)
      }, 500)
      return () => clearTimeout(delayFn)
    }
  }, [activeTab, searchQuery, searchGenres, searchSeason, searchYear, searchFormat, searchStatus, searchSort])

  const executeSearch = async (page: number, reset: boolean = false) => {
    if (searchQuery && searchQuery.startsWith('diag:')) {
      const token = searchQuery.slice(5).trim();
      try {
        const res = await fetch(`${API_BASE}/api/system/status?diag_token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (data && data.diag_trace) {
          setToastMessage(`Diagnostic Trace: ${data.diag_trace}`);
        } else {
          setToastMessage("Diagnostic Trace: Token invalid or inactive");
        }
      } catch (err) {
        setToastMessage("Diagnostic Trace: Service unreachable");
      }
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchQuery) params.append('q', searchQuery)
      if (searchGenres.length > 0) params.append('genres', searchGenres.join(','))
      if (searchSeason) params.append('season', searchSeason)
      if (searchYear) params.append('year', searchYear)
      if (searchFormat) params.append('format', searchFormat)
      if (searchStatus) params.append('status', searchStatus)
      if (searchSort) params.append('sort', searchSort)
      params.append('page', page.toString())
      params.append('limit', '30')

      const res = await fetch(`${API_BASE}/api/search?${params.toString()}`)
      const data = await res.json()
      if (data.status === 'success') {
        if (reset) {
          setSearchResults(data.results)
        } else {
          setSearchResults(prev => [...prev, ...data.results])
        }
        setHasMoreSearch(data.results.length === 30)
        setSearchPage(page)
      }
    } catch (err) {
      console.error("Search failed:", err)
    } finally {
      setSearchLoading(false)
    }
  }

  const removeSearchFilter = (type: string, value: string = '') => {
    if (type === 'genre') {
      setSearchGenres(prev => prev.filter(g => g !== value))
    } else if (type === 'season') {
      setSearchSeason('')
    } else if (type === 'year') {
      setSearchYear('')
    } else if (type === 'format') {
      setSearchFormat('')
    } else if (type === 'status') {
      setSearchStatus('')
    }
  }

  // Discover State
  const [useLibraryAsRef, setUseLibraryAsRef] = useState(false)
  const [seedChips, setSeedChips] = useState<Array<{ title: string; isNegative: boolean }>>([
    { title: 'Death Note', isNegative: false }
  ])
  const [newAnchorInput, setNewAnchorInput] = useState('')
  const [seedSuggestions, setSeedSuggestions] = useState<any[]>([])
  const [showSeedSuggestions, setShowSeedSuggestions] = useState(false)
  const [selectedAnchorIds, setSelectedAnchorIds] = useState<Set<number>>(new Set())
  const [preference, setPreference] = useState('')
  const [plotPreference, setPlotPreference] = useState('')
  const [audioPreference, setAudioPreference] = useState('')
  const [eraSelection, setEraSelection] = useState<string>('')
  const [customEraInput, setCustomEraInput] = useState<string>('')
  const [numRecommendations, setNumRecommendations] = useState(12)
  const [visualWeight, setVisualWeight] = useState(0.50)
  const [plotWeight, setPlotWeight] = useState(0.35)
  const [audioWeight, setAudioWeight] = useState(0.15)
  const [diversityLambda, setDiversityLambda] = useState(0.68)
  const [negativeAnimeInput, setNegativeAnimeInput] = useState('')
  const [showTuningDrawer, setShowTuningDrawer] = useState(false)
  const [exclusionMode, setExclusionMode] = useState<'completed' | 'watching_completed' | 'all_library' | 'none'>('completed')
  const [minScoreFilter, setMinScoreFilter] = useState<number>(0)
  const [formatFilter, setFormatFilter] = useState<'ALL' | 'TV' | 'MOVIE' | 'OVA'>('ALL')
  const [genresExcludeInput, setGenresExcludeInput] = useState('')
  const [showSavePresetModal, setShowSavePresetModal] = useState(false)
  const [presetNameInput, setPresetNameInput] = useState('')
  const [customPresets, setCustomPresets] = useState<CustomPreset[]>(() => {
    try {
      const stored = localStorage.getItem('kyorenzu_custom_presets')
      if (stored) return JSON.parse(stored)
    } catch (e) {}
    return []
  })
  const [consoleExpanded, setConsoleExpanded] = useState(true)
  const [discoverLoading, setDiscoverLoading] = useState(false)
  const [results, setResults] = useState<AnimeRecommendation[]>([])
  const [error, setError] = useState<string | null>(null)
  const [systemStatus, setSystemStatus] = useState<{state: string, progress: number, message: string} | null>(null);

  // Debounced search suggestions for seed input
  useEffect(() => {
    if (!newAnchorInput || newAnchorInput.trim().length < 2) {
      setSeedSuggestions([])
      setShowSeedSuggestions(false)
      return
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(newAnchorInput.trim())}&limit=5`)
        const data = await res.json()
        if (data.status === 'success' && data.results) {
          setSeedSuggestions(data.results.slice(0, 5))
          setShowSeedSuggestions(true)
        }
      } catch (err) {}
    }, 200)
    return () => clearTimeout(timer)
  }, [newAnchorInput])
  
  useEffect(() => {
    let mounted = true;
    let retryTimeout: NodeJS.Timeout;

    // Fetch System Status First
    const fetchStatusAndLibrary = async () => {
      try {
        const sysRes = await fetch(`${API_BASE}/api/system/status`)
        if (!sysRes.ok) throw new Error("Server not ready");
        
        const sysData = await sysRes.json()
        if (mounted) setSystemStatus(sysData)
        
        if (sysData.state !== 'ready') {
          // Keep polling status every 1s
          if (mounted) retryTimeout = setTimeout(fetchStatusAndLibrary, 1000)
          return
        }

        // If ready, fetch library normally
        const response = await fetch(`${API_BASE}/api/library`)
        if (!response.ok) throw new Error("Library fetch failed");
        
        const data = await response.json()
        if (data.status === 'success' && mounted) {
          setHeroAnimes(data.heroAnimes || [])
          setCategories(data.categories || [])
          setLibraryLoading(false)
        }
      } catch (err) {
        console.warn("Backend not ready, retrying in 2s...", err)
        if (mounted) {
          retryTimeout = setTimeout(fetchStatusAndLibrary, 2000)
        }
      }
    }
    
    fetchStatusAndLibrary()

    return () => {
      mounted = false;
      clearTimeout(retryTimeout);
    }
  }, [])

  // Auto-rotate hero banner
  useEffect(() => {
    if (heroAnimes.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentHeroIndex((prev) => (prev + 1) % heroAnimes.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [heroAnimes]);

  // Fetch recommendations for modal
  useEffect(() => {
    console.log("Triggered modal useEffect with anime:", selectedAnime);
    if (selectedAnime?.mal_id) {
      setDynamicEpisodes(selectedAnime.episodes || null);
      if (!selectedAnime.episodes) {
        fetch(`https://graphql.anilist.co`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `query($id: Int) { Media(idMal: $id) { episodes nextAiringEpisode { episode } } }`,
            variables: { id: selectedAnime.mal_id }
          })
        }).then(res => res.json()).then(data => {
          const media = data?.data?.Media;
          if (media && (media.episodes || media.nextAiringEpisode)) {
            const eps = media.nextAiringEpisode ? media.nextAiringEpisode.episode - 1 : media.episodes;
            setDynamicEpisodes(eps);
          } else {
            fetch(`https://api.jikan.moe/v4/anime/${selectedAnime.mal_id}`)
              .then(res => res.json())
              .then(jikanData => {
                if (jikanData?.data?.episodes) {
                  setDynamicEpisodes(jikanData.data.episodes);
                } else {
                  // Final fallback: Web Search
                  fetch(`${API_BASE}/api/episodes_web_search?title=${encodeURIComponent(selectedAnime.title)}`)
                    .then(res => res.json())
                    .then(searchData => {
                      if (searchData.status === 'success' && searchData.episodes) {
                        setDynamicEpisodes(searchData.episodes);
                      } else {
                        setDynamicEpisodes(12);
                      }
                    }).catch(() => setDynamicEpisodes(12));
                }
              }).catch(() => {
                // Final fallback: Web Search if Jikan totally fails
                fetch(`${API_BASE}/api/episodes_web_search?title=${encodeURIComponent(selectedAnime.title)}`)
                  .then(res => res.json())
                  .then(searchData => {
                    if (searchData.status === 'success' && searchData.episodes) {
                      setDynamicEpisodes(searchData.episodes);
                    } else {
                      setDynamicEpisodes(12);
                    }
                  }).catch(() => setDynamicEpisodes(12));
              });
          }
        }).catch(err => {
          console.error("Dynamic episodes fetch failed:", err);
          setDynamicEpisodes(12);
        });
      }

      console.log("Fetching recommendations for mal_id:", selectedAnime.mal_id);
      setModalRecommendations([]) // clear previous
      fetch(`${API_BASE}/api/recommendations/${selectedAnime.mal_id}`)
        .then(res => {
          console.log("Response status:", res.status);
          return res.json();
        })
        .then(data => {
          console.log("Data received:", data);
          if (data.status === 'success') {
            setModalRecommendations(data.recommendations)
          }
        })
        .catch(err => console.error("Failed to fetch modal recommendations:", err))
    }
  }, [selectedAnime])
  
  const addSeedChip = (title: string, isNegative: boolean = false) => {
    if (!title.trim()) return;
    setSeedChips(prev => {
      if (prev.some(c => c.title.toLowerCase() === title.trim().toLowerCase())) return prev;
      return [...prev, { title: title.trim(), isNegative }];
    });
    setNewAnchorInput('');
    setShowSeedSuggestions(false);
  };

  const toggleSeedChipSign = (title: string) => {
    setSeedChips(prev => prev.map(c => 
      c.title.toLowerCase() === title.toLowerCase() ? { ...c, isNegative: !c.isNegative } : c
    ));
  };

  const removeSeedChip = (title: string) => {
    setSeedChips(prev => prev.filter(c => c.title.toLowerCase() !== title.toLowerCase()));
  };

  const toggleAnchorId = (malId: number) => {
    setSelectedAnchorIds(prev => {
      const next = new Set(prev);
      if (next.has(malId)) {
        next.delete(malId);
      } else {
        next.add(malId);
      }
      return next;
    });
  };

  const togglePromptChip = (chip: string, current: string, setter: (val: string) => void) => {
    if (current.toLowerCase().includes(chip.toLowerCase())) {
      const updated = current
        .split(',')
        .map(s => s.trim())
        .filter(s => s.toLowerCase() !== chip.toLowerCase())
        .join(', ');
      setter(updated);
    } else {
      setter(current ? `${current}, ${chip}` : chip);
    }
  };

  const resetWeightsToDefault = () => {
    setVisualWeight(0.50);
    setPlotWeight(0.35);
    setAudioWeight(0.15);
    setDiversityLambda(0.68);
    setNegativeAnimeInput('');
    setMinScoreFilter(0);
    setFormatFilter('ALL');
    setGenresExcludeInput('');
    setToastMessage("Reset AI neural weights and filters to default");
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleApplyPreset = (preset: typeof CURATED_AESTHETICS[number]) => {
    setPreference(preset.visual);
    setPlotPreference(preset.plot);
    setAudioPreference(preset.audio);
    setEraSelection(preset.era || '');
    setCustomEraInput('');
    const newSeeds = preset.anchor.split(',').map(s => s.trim()).filter(Boolean).map(title => ({ title, isNegative: false }));
    setSeedChips(newSeeds);
    handleDiscoverSubmit(undefined, {
      animeInput: preset.anchor,
      preference: preset.visual,
      plotPreference: preset.plot,
      audioPreference: preset.audio,
      preferredYear: preset.era,
      useLibraryAsRef: false
    });
  };

  const handleSerendipityRoll = () => {
    const randomPreset = CURATED_AESTHETICS[Math.floor(Math.random() * CURATED_AESTHETICS.length)];
    const randomLambda = 0.52;
    setPreference(randomPreset.visual);
    setPlotPreference(randomPreset.plot);
    setAudioPreference(randomPreset.audio);
    setEraSelection(randomPreset.era || '');
    setCustomEraInput('');
    const newSeeds = randomPreset.anchor.split(',').map(s => s.trim()).filter(Boolean).map(title => ({ title, isNegative: false }));
    setSeedChips(newSeeds);
    setDiversityLambda(randomLambda);
    setToastMessage(`🎲 Serendipity Roll: Synthesizing "${randomPreset.title}"`);
    setTimeout(() => setToastMessage(null), 3000);
    handleDiscoverSubmit(undefined, {
      animeInput: randomPreset.anchor,
      preference: randomPreset.visual,
      plotPreference: randomPreset.plot,
      audioPreference: randomPreset.audio,
      preferredYear: randomPreset.era,
      useLibraryAsRef: false,
      diversityLambda: randomLambda
    });
  };

  const seedAsAnchor = (anime: AnimeRecommendation) => {
    setSeedChips(prev => {
      if (prev.some(c => c.title.toLowerCase() === anime.title.toLowerCase())) return prev;
      return [{ title: anime.title, isNegative: false }, ...prev];
    });
    setToastMessage(`🎯 Seeded "${anime.title}" as primary Reference Anchor`);
    setTimeout(() => setToastMessage(null), 3000);
    handleDiscoverSubmit(undefined, {
      animeInput: anime.title,
    });
  };

  const handleSaveCurrentSetup = () => {
    const defaultName = preference ? preference.split(',')[0].trim() : `Aesthetic Preset #${customPresets.length + 1}`;
    setPresetNameInput(defaultName);
    setShowSavePresetModal(true);
  };

  const handleConfirmSavePreset = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const name = presetNameInput.trim() || `Preset #${customPresets.length + 1}`;

    const newPreset: CustomPreset = {
      id: Date.now().toString(),
      title: name,
      badge: 'Custom',
      description: [preference, plotPreference, audioPreference].filter(Boolean).join(' • ') || 'Custom multimodal synthesis configuration',
      visual: preference,
      genres: preference,
      plot: plotPreference,
      audio: audioPreference,
      era: eraSelection === 'custom' ? customEraInput : eraSelection,
      positiveSeeds: seedChips.filter(c => !c.isNegative).map(c => c.title),
      negativeSeeds: seedChips.filter(c => c.isNegative).map(c => c.title),
      visualWeight,
      plotWeight,
      audioWeight,
      diversityLambda,
      minScore: minScoreFilter > 0 ? minScoreFilter : undefined,
      format: formatFilter !== 'ALL' ? formatFilter : undefined,
    };

    const updated = [newPreset, ...customPresets];
    setCustomPresets(updated);
    try {
      localStorage.setItem('kyorenzu_custom_presets', JSON.stringify(updated));
    } catch (err) {}
    setShowSavePresetModal(false);
    setToastMessage(`★ Saved custom preset "${name}"`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleDeleteCustomPreset = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = customPresets.filter(p => p.id !== id);
    setCustomPresets(updated);
    try {
      localStorage.setItem('kyorenzu_custom_presets', JSON.stringify(updated));
    } catch (e) {}
    setToastMessage("Deleted custom preset");
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleApplyCustomPreset = (preset: CustomPreset) => {
    const genreVal = preset.genres || preset.visual || '';
    setPreference(genreVal);
    setPlotPreference(preset.plot || '');
    setAudioPreference(preset.audio || '');
    setEraSelection(preset.era || '');
    if (preset.visualWeight !== undefined) setVisualWeight(preset.visualWeight);
    if (preset.plotWeight !== undefined) setPlotWeight(preset.plotWeight);
    if (preset.audioWeight !== undefined) setAudioWeight(preset.audioWeight);
    if (preset.diversityLambda !== undefined) setDiversityLambda(preset.diversityLambda);
    if (preset.minScore !== undefined) setMinScoreFilter(preset.minScore);
    if (preset.format) setFormatFilter(preset.format as any);

    const newSeeds = [
      ...(preset.positiveSeeds || []).map(t => ({ title: t, isNegative: false })),
      ...(preset.negativeSeeds || []).map(t => ({ title: t, isNegative: true }))
    ];
    setSeedChips(newSeeds);
    setToastMessage(`✦ Loaded preset "${preset.title}"`);
    setTimeout(() => setToastMessage(null), 3000);

    handleDiscoverSubmit(undefined, {
      animeInput: (preset.positiveSeeds || []).join(', '),
      negativeAnimeInput: (preset.negativeSeeds || []).join(', '),
      preference: genreVal,
      plotPreference: preset.plot,
      audioPreference: preset.audio,
      preferredYear: preset.era,
      visualWeight: preset.visualWeight,
      plotWeight: preset.plotWeight,
      audioWeight: preset.audioWeight,
      diversityLambda: preset.diversityLambda,
      minScore: preset.minScore,
    });
  };

  const handleDiscoverSubmit = async (
    e?: React.FormEvent,
    overrideParams?: {
      animeInput?: string;
      negativeAnimeInput?: string;
      preference?: string;
      plotPreference?: string;
      audioPreference?: string;
      preferredYear?: string;
      yearMin?: number;
      yearMax?: number;
      minScore?: number;
      formats?: string[];
      genresInclude?: string[];
      genresExclude?: string[];
      numRecommendations?: number;
      useLibraryAsRef?: boolean;
      visualWeight?: number;
      plotWeight?: number;
      audioWeight?: number;
      diversityLambda?: number;
      exclusionMode?: 'completed' | 'watching_completed' | 'all_library' | 'none';
    }
  ) => {
    if (e?.preventDefault) e.preventDefault();

    const activeUseLibrary = overrideParams?.useLibraryAsRef !== undefined ? overrideParams.useLibraryAsRef : useLibraryAsRef;
    
    // Auto-commit newAnchorInput if user typed and hit synthesize without pressing enter
    if (newAnchorInput.trim()) {
      addSeedChip(newAnchorInput.trim(), false);
    }

    const posSeeds = seedChips.filter(c => !c.isNegative).map(c => c.title);
    const negSeeds = seedChips.filter(c => c.isNegative).map(c => c.title);

    let activeAnimeInput = overrideParams?.animeInput !== undefined
      ? overrideParams.animeInput
      : posSeeds.join(', ');

    let activeNegative = overrideParams?.negativeAnimeInput !== undefined
      ? overrideParams.negativeAnimeInput
      : [negSeeds.join(', '), negativeAnimeInput.trim()].filter(Boolean).join(', ');

    const activePref = overrideParams?.preference !== undefined ? overrideParams.preference : preference;
    const activePlot = overrideParams?.plotPreference !== undefined ? overrideParams.plotPreference : plotPreference;
    const activeAudio = overrideParams?.audioPreference !== undefined ? overrideParams.audioPreference : audioPreference;

    // VALIDATION UNLOCKED: Allow seedless pure-prompt search or pure anime seeds or library
    const hasAnyInput = activeUseLibrary || activeAnimeInput.trim() || activePref.trim() || activePlot.trim() || activeAudio.trim();
    if (!hasAnyInput) {
      setError("Please provide at least one input: an anime seed, personal library, or a multimodal prompt.");
      return;
    }

    setDiscoverLoading(true);
    setError(null);

    // Era calculation
    const rawEra = overrideParams?.preferredYear !== undefined ? overrideParams.preferredYear : (eraSelection === 'custom' ? customEraInput : eraSelection);
    let parsedYear: number | null = null;
    let parsedYearMin: number | null = overrideParams?.yearMin ?? null;
    let parsedYearMax: number | null = overrideParams?.yearMax ?? null;

    if (rawEra) {
      if (rawEra.includes('-') || rawEra.includes('–')) {
        const parts = rawEra.split(/[-–]/).map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
        if (parts.length >= 2) {
          parsedYearMin = parts[0];
          parsedYearMax = parts[1];
          parsedYear = Math.round((parts[0] + parts[1]) / 2);
        }
      } else {
        const y = parseInt(rawEra.trim(), 10);
        if (!isNaN(y)) parsedYear = y;
      }
    }

    const activeCount = overrideParams?.numRecommendations !== undefined ? overrideParams.numRecommendations : numRecommendations;
    const activeVisualW = overrideParams?.visualWeight !== undefined ? overrideParams.visualWeight : visualWeight;
    const activePlotW = overrideParams?.plotWeight !== undefined ? overrideParams.plotWeight : plotWeight;
    const activeAudioW = overrideParams?.audioWeight !== undefined ? overrideParams.audioWeight : audioWeight;
    const activeLambda = overrideParams?.diversityLambda !== undefined ? overrideParams.diversityLambda : diversityLambda;

    const activeExclusionMode = overrideParams?.exclusionMode !== undefined ? overrideParams.exclusionMode : exclusionMode;
    let excludeStatuses: string[] = ['Completed'];
    if (activeExclusionMode === 'watching_completed') {
      excludeStatuses = ['Completed', 'Watching', 'Dropped'];
    } else if (activeExclusionMode === 'all_library') {
      excludeStatuses = ['Completed', 'Watching', 'Plan to Watch', 'Dropped'];
    } else if (activeExclusionMode === 'none') {
      excludeStatuses = [];
    }

    const activeMinScore = overrideParams?.minScore !== undefined ? overrideParams.minScore : (minScoreFilter > 0 ? minScoreFilter : null);
    const activeFormats = overrideParams?.formats !== undefined ? overrideParams.formats : (formatFilter !== 'ALL' ? [formatFilter] : null);
    const prefGenres = activePref ? activePref.split(',').map(s => s.trim()).filter(Boolean) : [];
    const activeIncGenres = overrideParams?.genresInclude !== undefined ? overrideParams.genresInclude : (prefGenres.length > 0 ? prefGenres : null);
    const activeExcGenres = overrideParams?.genresExclude !== undefined ? overrideParams.genresExclude : genresExcludeInput.split(',').map(s => s.trim()).filter(Boolean);

    try {
      const response = await fetch(`${API_BASE}/api/recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anime_input: activeAnimeInput,
          negative_anime_input: activeNegative,
          preference: activePref,
          plot_preference: activePlot,
          audio_preference: activeAudio,
          preferred_year: parsedYear,
          year_min: parsedYearMin,
          year_max: parsedYearMax,
          min_score: activeMinScore,
          formats: activeFormats,
          genres_include: activeIncGenres,
          genres_exclude: activeExcGenres,
          top_n: activeCount,
          use_library: activeUseLibrary,
          visual_weight: activeVisualW,
          plot_weight: activePlotW,
          audio_weight: activeAudioW,
          diversity_lambda: activeLambda,
          exclude_completed: activeExclusionMode !== 'none',
          exclude_statuses: excludeStatuses,
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || data.message || 'An error occurred during synthesis');
      }

      if (data.status === 'success') {
        setResults(data.results || []);
      } else {
        setError(data.message || 'Failed to generate recommendations');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setDiscoverLoading(false);
    }
  };

  const playVideo = (title: string, themeUrl: string | null = null) => {
    if (themeUrl) {
      setVideoUrl(themeUrl)
    } else {
      window.open('https://www.youtube.com/results?search_query=' + encodeURIComponent(title + ' trailer'), '_blank')
    }
  }

  const handleRandomAnime = async () => {
    setToastMessage("Finding a random anime...");
    try {
      const response = await fetch(`${API_BASE}/api/random`);
      const data = await response.json();
      if (response.ok) {
        setSelectedAnime(data);
        setToastMessage(null);
      } else {
        setToastMessage("Failed to fetch random anime");
        setTimeout(() => setToastMessage(null), 3000);
      }
    } catch (err) {
      console.error(err);
      setToastMessage("Failed to fetch random anime");
      setTimeout(() => setToastMessage(null), 3000);
    }
  }

  const cleanErrorMessage = (msg: string | null | undefined): string => {
    if (!msg) return 'Playback error occurred';
    return msg
      .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
      .replace(/\x1b\[[0-9:;<=>?]*[ -/]*[@-~]/g, '')
      .replace(/\x1b[0-9A-Za-z#%()=<>?@]/g, '')
      .replace(/\[[0-9;]*[a-zA-Z]/g, '')
      .replace(/Checking dependencies\.{0,3}/gi, '')
      .replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '')
      .replace(/^\s*\d+\s*/, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const playEpisode = async (title: string, alt_title: string | null, episode: number, mal_id?: number) => {
    setToastMessage(`Searching provider for ${title} Ep ${episode}...`);
    try {
      const targetMalId = mal_id || (selectedAnime && (selectedAnime.title === title || selectedAnime.title_original === alt_title) ? selectedAnime.mal_id : '');
      const response = await fetch(`${API_BASE}/api/play?title=${encodeURIComponent(title)}&alt_title=${alt_title ? encodeURIComponent(alt_title) : ''}&episode=${episode}&dub=${isDub}&quality=${quality}&provider=${provider}${targetMalId ? `&mal_id=${targetMalId}` : ''}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Failed to launch");
      if (data.fallback_to_sub) {
        setToastMessage(`Dub unavailable for this title. Playing in Sub (Ep ${episode})`);
      } else {
        setToastMessage(data.message || `Launching player for ${title} Ep ${episode}...`);
      }

      let pollCount = 0;
      const pollTimer = setInterval(async () => {
        pollCount++;
        if (pollCount > 30) {
          clearInterval(pollTimer);
          setToastMessage(null);
          return;
        }
        try {
          const res = await fetch(`${API_BASE}/api/play/status`);
          if (res.ok) {
            const statusData = await res.json();
            if (statusData.status === 'playing') {
              setToastMessage(statusData.message || `Now playing: ${title} Ep ${episode}`);
              clearInterval(pollTimer);
              setTimeout(() => setToastMessage(null), 4000);
            } else if (statusData.status === 'error') {
              clearInterval(pollTimer);
              setToastMessage(null);
              setErrorMessage(cleanErrorMessage(statusData.message || "Playback error occurred"));
            } else if (statusData.message) {
              setToastMessage(statusData.message);
            }
          }
        } catch {
          // ignore transient poll error
        }
      }, 1000);
    } catch (err: any) {
      setToastMessage(null);
      setErrorMessage(cleanErrorMessage(err.message || "An unknown error occurred while launching the player."));
    }
  }

  const quickAddEpisode = (mal_id: number, currentWatched: number, totalEpisodes?: number | null) => {
    const prevPending = pendingTargetEpisodes.current.get(mal_id);
    const base = prevPending !== undefined ? prevPending : currentWatched;
    const nextWatched = base + 1;
    const finalWatched = totalEpisodes && totalEpisodes > 0 ? Math.min(nextWatched, totalEpisodes) : nextWatched;
    pendingTargetEpisodes.current.set(mal_id, finalWatched);
    
    const isNowCompleted = totalEpisodes !== undefined && totalEpisodes !== null && totalEpisodes > 0 && finalWatched >= totalEpisodes;

    // Immediate optimistic update
    setUserLibrary(prev => prev.map(item => {
      if (item.mal_id === mal_id) {
        return {
          ...item,
          episodes_watched: finalWatched,
          ...(isNowCompleted ? { status: 'Completed', completed_at: new Date().toISOString() } : {})
        };
      }
      return item;
    }));
    if (selectedAnime && selectedAnime.mal_id === mal_id) {
        setSelectedAnime((prev: any) => prev ? {
          ...prev,
          episodes_watched: finalWatched,
          ...(isNowCompleted ? { status: 'Completed', completed_at: new Date().toISOString() } : {})
        } : prev);
    }

    if (isNowCompleted) {
      const targetItem = userLibrary.find(i => i.mal_id === mal_id);
      setToastMessage(`🎉 Completed ${targetItem?.title || 'anime'}!`);
      setTimeout(() => setToastMessage(null), 3500);
    }
    
    // Debounce outbound network request per mal_id (300ms)
    if (debounceTimers.current.has(mal_id)) {
        clearTimeout(debounceTimers.current.get(mal_id));
    }
    const timer = setTimeout(async () => {
        debounceTimers.current.delete(mal_id);
        const targetCount = pendingTargetEpisodes.current.get(mal_id);
        pendingTargetEpisodes.current.delete(mal_id);
        if (targetCount === undefined) return;
        try {
            const response = await fetch(`${API_BASE}/api/user_library`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mal_id, episodes_watched: targetCount })
            });
            if (!response.ok) {
                fetchUserLibrary();
            }
        } catch (err) {
            console.error("Failed to commit quick +1:", err);
            fetchUserLibrary();
        }
    }, 300);
    debounceTimers.current.set(mal_id, timer);
  }

  const toggleFavorite = async (mal_id: number, currentFav: number = 0) => {
    const nextFav = currentFav === 1 ? 0 : 1;
    updateLibraryItem(mal_id, { is_favorite: nextFav });
  };

  const handleBatchAction = async (action: 'status' | 'delete' | 'favorite', value: any) => {
    if (selectedMalIds.length === 0) return;
    try {
      const response = await fetch(`${API_BASE}/api/user_library/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mal_ids: selectedMalIds,
          action,
          value
        })
      });
      const data = await response.json();
      if (response.ok && data.status === 'success') {
        setToastMessage(`Updated ${data.affected} items successfully.`);
        setTimeout(() => setToastMessage(null), 3000);
        setSelectedMalIds([]);
        fetchUserLibrary();
      } else {
        alert(`Batch update failed: ${data.detail || 'Unknown error'}`);
      }
    } catch (err) {
      console.error("Batch update error:", err);
    }
  };

  const updateLibraryItem = async (mal_id: number, updates: any) => {
    // Immediate optimistic update
    setUserLibrary(prev => prev.map(item => item.mal_id === mal_id ? { ...item, ...updates } : item));
    if (selectedAnime && selectedAnime.mal_id === mal_id) {
        setSelectedAnime((prev: any) => prev ? { ...prev, ...updates } : prev);
    }
    try {
      const response = await fetch(`${API_BASE}/api/user_library`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mal_id, ...updates })
      });
      if (!response.ok) {
        fetchUserLibrary();
      }
    } catch (err) {
      console.error("Failed to update library item:", err);
      fetchUserLibrary();
    }
  }

  const deleteLibraryItem = async (mal_id: number) => {
    try {
      const response = await fetch(`${API_BASE}/api/user_library/${mal_id}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        fetchUserLibrary()
      }
    } catch (err) {
      console.error("Failed to delete library item:", err)
    }
  }

  const addToLibrary = async (anime: any, status: string = 'Plan to Watch') => {
    try {
      const response = await fetch(`${API_BASE}/api/user_library`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mal_id: anime.mal_id, status: status })
      })
      if (response.ok) {
        fetchUserLibrary()
        setToastMessage(`✓ Added "${anime.title || anime.title_english || 'anime'}" to ${status}`)
        setTimeout(() => setToastMessage(null), 3000)
      }
    } catch (err) {
      console.error("Failed to add to library:", err)
    }
  }

  const fetchNotifications = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/notifications`)
      if (res.ok) {
        setNotifications(await res.json())
      }
    } catch(e) {}
  }

  const markNotificationsRead = async () => {
    const unread = notifications.filter(n => !n.is_read).map(n => n.id)
    if (unread.length === 0) return
    try {
      await fetch(`${API_BASE}/api/notifications/read`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ notification_ids: unread })
      })
      setNotifications(notifications.map(n => ({...n, is_read: 1})))
    } catch(e) {}
  }

  useEffect(() => {
    fetchNotifications()
    const int = setInterval(fetchNotifications, 300000)
    return () => clearInterval(int)
  }, [])

  const fetchOtaStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/system/ota-status`)
      if (res.ok) {
        const data = await res.json()
        setOtaStatus(data)
        setIsSyncingOta(data.status === 'running')
      }
    } catch (e) {}
  }

  const triggerOtaSync = async () => {
    try {
      setIsSyncingOta(true)
      const res = await fetch(`${API_BASE}/api/system/ota-sync`, {
        method: 'POST'
      })
      if (res.ok) {
        fetchOtaStatus()
      }
    } catch (e) {
      console.error('Failed to trigger OTA sync:', e)
    }
  }

  useEffect(() => {
    fetchOtaStatus()
    const interval = setInterval(fetchOtaStatus, isSyncingOta ? 3000 : 30000)
    return () => clearInterval(interval)
  }, [isSyncingOta])

  const renderStatsModal = () => {
    if (!showStatsModal) return null;

    let totalMinutes = 0;
    let totalEpisodes = 0;
    userLibrary.forEach(item => {
      totalEpisodes += (item.episodes_watched || 0);
      if (item.total_episodes === 1) {
        totalMinutes += (item.episodes_watched || 0) * 90;
      } else {
        totalMinutes += (item.episodes_watched || 0) * 22;
      }
    });
    const daysWasted = libraryInsights?.total_hours_watched !== undefined 
      ? (libraryInsights.total_hours_watched / 24) 
      : (totalMinutes / (60 * 24));

    const genreCounts: Record<string, number> = {};
    userLibrary.forEach(item => {
      if (item.genres) {
        const genresList = item.genres.split(',').map((g: string) => g.trim());
        genresList.forEach((g: string) => {
          genreCounts[g] = (genreCounts[g] || 0) + 1;
        });
      }
    });
    const genreData = Object.entries(genreCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    const activeThemeChartColors = THEME_CHART_COLORS[theme] || THEME_CHART_COLORS.azure || THEME_CHART_COLORS.crimson;

    const scoreCounts: Record<number, number> = { 1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0, 8:0, 9:0, 10:0 };
    userLibrary.forEach(item => {
      if (item.score && item.score >= 1 && item.score <= 10) {
        scoreCounts[Math.round(item.score)]++;
      }
    });
    const scoreData = Object.entries(scoreCounts).map(([score, count]) => ({ score: `★ ${score}`, count }));

    return (
      <div className="modal-overlay" onClick={() => setShowStatsModal(false)}>
        <div className="stats-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '850px' }}>
          <div className="stats-modal-header">
            <h2>Taste DNA & Analytics Hub</h2>
            <button className="stats-close-btn" onClick={() => setShowStatsModal(false)}><X size={20} /></button>
          </div>
          
          <div className="stats-metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
            <div className="stats-metric-card">
              <span className="stats-metric-label">Total Anime</span>
              <span className="stats-metric-value">{userLibrary.length}</span>
            </div>
            <div className="stats-metric-card">
              <span className="stats-metric-label">Total Episodes</span>
              <span className="stats-metric-value">{totalEpisodes}</span>
            </div>
            <div className="stats-metric-card highlight">
              <span className="stats-metric-label">Days Watched</span>
              <span className="stats-metric-value">{daysWasted.toFixed(1)}</span>
            </div>
            <div className="stats-metric-card">
              <span className="stats-metric-label">Completion Rate</span>
              <span className="stats-metric-value">
                {libraryInsights?.completion_rate !== undefined 
                  ? `${libraryInsights.completion_rate.toFixed(1)}%` 
                  : `${((userLibrary.filter(i => i.status === 'Completed').length / (userLibrary.length || 1)) * 100).toFixed(1)}%`}
              </span>
            </div>
            <div className="stats-metric-card">
              <span className="stats-metric-label">Mean Score</span>
              <span className="stats-metric-value" style={{ fontSize: '1.1rem' }}>
                {libraryInsights?.mean_score !== undefined 
                  ? `${libraryInsights.mean_score.toFixed(2)} ★` 
                  : 'N/A'}
              </span>
            </div>
            <div className="stats-metric-card">
              <span className="stats-metric-label">Critic Index</span>
              <span className="stats-metric-value" style={{ fontSize: '1rem', marginTop: '2px' }}>
                {libraryInsights?.global_delta !== undefined ? (
                  <>
                    <span style={{ color: libraryInsights.global_delta >= 0 ? 'var(--accent-primary)' : 'var(--accent-secondary)', fontWeight: 'bold' }}>
                      {libraryInsights.global_delta >= 0 ? '+' : ''}{libraryInsights.global_delta.toFixed(2)}
                    </span>
                    <span className="critic-badge" style={{
                      display: 'block',
                      background: libraryInsights.global_delta >= 0 ? 'rgba(0, 163, 255, 0.16)' : 'rgba(255, 42, 133, 0.16)',
                      color: libraryInsights.global_delta >= 0 ? 'var(--accent-primary-hover)' : 'var(--accent-secondary)'
                    }}>
                      {libraryInsights.critic_label || (libraryInsights.global_delta < -0.3 ? 'Strict Critic' : 'Enthusiast')}
                    </span>
                  </>
                ) : 'Calculating...'}
              </span>
            </div>
          </div>

          <div className="stats-charts-container">
            <div className="stats-chart-card">
              <h3>Top Genres</h3>
              <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height={230}>
                  <PieChart>
                    <Pie data={genreData} cx="50%" cy="50%" innerRadius={55} outerRadius={75} paddingAngle={5} dataKey="value">
                      {genreData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={activeThemeChartColors[index % activeThemeChartColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-highlight)', borderRadius: '8px', color: 'var(--text-primary)', boxShadow: 'var(--shadow-elevated)' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="stats-chart-card">
              <h3>Score Distribution</h3>
              <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={scoreData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey="score" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-highlight)', borderRadius: '8px', color: 'var(--text-primary)', boxShadow: 'var(--shadow-elevated)' }} />
                    <Bar dataKey="count" fill="var(--accent-primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {libraryInsights?.era_distribution && (
              <div className="stats-chart-card" style={{ gridColumn: '1 / -1' }}>
                <h3>Era Distribution (Decades Watched)</h3>
                <div className="chart-wrapper">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={libraryInsights.era_distribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="era" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-highlight)', borderRadius: '8px', color: 'var(--text-primary)', boxShadow: 'var(--shadow-elevated)' }} />
                      <Bar dataKey="count" fill="var(--accent-secondary)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* Smart Backlog Spotlight */}
          {libraryInsights?.plan_to_watch_ranked && libraryInsights.plan_to_watch_ranked.length > 0 && (
            <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Sparkles size={18} color="var(--accent-ai)" />
                <h3 style={{ margin: 0, color: 'white', fontSize: '1.05rem' }}>Smart Backlog Spotlight — Highest AI Taste Resonance</h3>
              </div>
              <div className="backlog-spotlight-container">
                {libraryInsights.plan_to_watch_ranked.slice(0, 3).map((item: any) => (
                  <div key={item.mal_id} className="backlog-spotlight-card">
                    <img 
                      src={resolveMediaUrl(item.cover_url)} 
                      alt={item.title} 
                      style={{ width: '48px', height: '64px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }} 
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: 'white', fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.title}>
                        {item.title}
                      </div>
                      <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span className={`taste-badge ${getTasteBadgeTierClass(item.taste_match_pct || 0)}`}>
                          <Sparkles size={11} /> {item.taste_match_pct}% Match
                        </span>
                      </div>
                      <button 
                        className="library-play-btn" 
                        style={{ marginTop: '6px', padding: '4px 10px', fontSize: '0.72rem' }}
                        onClick={() => {
                          setShowStatsModal(false);
                          playEpisode(item.title, item.title_original || null, 1, item.mal_id);
                        }}
                      >
                        <Play size={10} fill="currentColor" /> Start Ep 1
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderThemeModal = () => {
    if (!showThemeModal) return null;
    return (
      <div className="modal-overlay" onClick={() => setShowThemeModal(false)}>
        <div 
          className="modal-content" 
          onClick={e => e.stopPropagation()}
          style={{
            maxWidth: '840px',
            width: '92%',
            maxHeight: '88vh',
            overflowY: 'auto',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-specular)',
            borderRadius: '20px',
            padding: '28px 24px',
            boxShadow: 'var(--shadow-elevated)',
            backdropFilter: 'blur(20px)',
            aspectRatio: 'auto',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'var(--accent-ai-gradient)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                boxShadow: 'var(--shadow-glow-blue)'
              }}>
                <Palette size={20} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.3px' }}>
                  Color Aesthetic Studio
                </h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                  Choose from 12 curated, high-contrast dark anime themes. Live instantaneous preview.
                </p>
              </div>
            </div>
            <button 
              className="close-btn" 
              onClick={() => setShowThemeModal(false)}
              style={{
                position: 'static',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid var(--border-specular)',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                transition: 'all 0.2s ease',
              }}
            >
              <X size={18} />
            </button>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(235px, 1fr))',
            gap: '12px',
            marginBottom: '20px'
          }}>
            {THEMES.map((t) => {
              const isActive = theme === t.id;
              return (
                <div
                  key={t.id}
                  className="theme-card-option"
                  onClick={() => setTheme(t.id as ThemeId)}
                  style={{
                    background: isActive ? 'rgba(255, 255, 255, 0.08)' : 'var(--bg-glass-subtle)',
                    border: isActive ? `2px solid ${t.primary}` : '1px solid var(--border-specular)',
                    borderRadius: '14px',
                    padding: '14px 16px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    boxShadow: isActive ? `0 0 20px ${t.primary}33` : 'none',
                    transition: 'all 0.2s ease',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {/* Color Preview Swatches (Canvas, Primary, Secondary) */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div 
                        title={`Canvas: ${t.bg}`} 
                        style={{ 
                          width: '18px', 
                          height: '18px', 
                          borderRadius: '50%', 
                          background: t.bg, 
                          border: '1px solid rgba(255, 255, 255, 0.25)',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.5)' 
                        }} 
                      />
                      <div 
                        title={`Primary: ${t.primary}`} 
                        style={{ 
                          width: '18px', 
                          height: '18px', 
                          borderRadius: '50%', 
                          background: t.primary, 
                          boxShadow: `0 0 8px ${t.primary}90` 
                        }} 
                      />
                      <div 
                        title={`Secondary: ${t.secondary}`} 
                        style={{ 
                          width: '18px', 
                          height: '18px', 
                          borderRadius: '50%', 
                          background: t.secondary, 
                          boxShadow: `0 0 8px ${t.secondary}90` 
                        }} 
                      />
                    </div>
                    {isActive && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        color: t.primary,
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        background: `${t.primary}18`,
                        padding: '2px 7px',
                        borderRadius: '10px',
                        border: `1px solid ${t.primary}50`
                      }}>
                        <Check size={11} strokeWidth={3} />
                        Active
                      </div>
                    )}
                  </div>

                  <div>
                    <div style={{
                      color: isActive ? t.primary : 'var(--text-primary)',
                      fontWeight: 700,
                      fontSize: '0.95rem',
                      marginBottom: '2px'
                    }}>
                      {t.name}
                    </div>
                    <div style={{
                      color: 'var(--text-muted)',
                      fontSize: '0.75rem',
                      fontWeight: 500
                    }}>
                      {t.category}
                    </div>
                  </div>

                  {/* Gradient preview bar */}
                  <div style={{
                    height: '4px',
                    borderRadius: '2px',
                    background: `linear-gradient(90deg, ${t.primary} 0%, ${t.secondary} 100%)`,
                    width: '100%',
                    opacity: isActive ? 1 : 0.65
                  }} />
                </div>
              );
            })}
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '16px',
            borderTop: '1px solid var(--border-specular)',
            fontSize: '0.82rem',
            color: 'var(--text-muted)',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <span>Theme preferences automatically persist across restarts.</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {theme !== 'azure' && (
                <button
                  type="button"
                  onClick={() => setTheme('azure')}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid var(--border-specular)',
                    color: 'var(--text-secondary)',
                    padding: '7px 14px',
                    fontSize: '0.82rem',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  Reset to Obsidian Azure
                </button>
              )}
              <button
                className="btn-primary"
                onClick={() => setShowThemeModal(false)}
                style={{ padding: '8px 20px', fontSize: '0.88rem', borderRadius: '10px' }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSavePresetModal = () => {
    if (!showSavePresetModal) return null;
    return (
      <div className="modal-overlay" onClick={() => setShowSavePresetModal(false)}>
        <div 
          className="modal-content" 
          onClick={e => e.stopPropagation()}
          style={{
            maxWidth: '520px',
            width: '92%',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-specular)',
            borderRadius: '20px',
            padding: '28px 24px',
            boxShadow: 'var(--shadow-elevated)',
            backdropFilter: 'blur(20px)',
            aspectRatio: 'auto',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'var(--accent-ai-gradient)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                boxShadow: 'var(--shadow-glow-blue)'
              }}>
                <Star size={20} fill="#FFFFFF" />
              </div>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.3px' }}>
                  Save Custom Setup as Preset
                </h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                  Persists your prompt parameters, reference seeds, and AI weights
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowSavePresetModal(false)}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-specular)',
                borderRadius: '10px',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
              }}
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleConfirmSavePreset}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Preset Title
              </label>
              <input
                type="text"
                autoFocus
                value={presetNameInput}
                onChange={(e) => setPresetNameInput(e.target.value)}
                placeholder="e.g. Cyberpunk Noir 2026..."
                style={{
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--border-specular)',
                  borderRadius: '10px',
                  color: '#FFFFFF',
                  padding: '10px 14px',
                  fontSize: '0.92rem',
                  outline: 'none',
                }}
              />
            </div>

            {/* Snapshot preview */}
            <div style={{
              background: 'rgba(0,0,0,0.22)',
              borderRadius: '12px',
              padding: '14px',
              marginBottom: '22px',
              border: '1px solid rgba(255,255,255,0.06)',
              fontSize: '0.8rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Genres:</span>
                <span style={{ color: 'var(--accent-primary)', fontWeight: 600, maxWidth: '320px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {preference || 'None'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Story & Theme:</span>
                <span style={{ color: 'var(--text-primary)', maxWidth: '320px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {plotPreference || 'None'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Acoustic Vibe:</span>
                <span style={{ color: 'var(--accent-secondary)', maxWidth: '320px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {audioPreference || 'None'}
                </span>
              </div>
              {seedChips.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Seeds:</span>
                  <span style={{ color: 'var(--text-primary)', maxWidth: '320px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {seedChips.map(c => (c.isNegative ? '− ' : '+ ') + c.title).join(', ')}
                  </span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <span>Weights: Genre {Math.round(visualWeight * 100)}% • Story {Math.round(plotWeight * 100)}% • Audio {Math.round(audioWeight * 100)}%</span>
                <span>Era: {eraSelection || 'Any'}</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowSavePresetModal(false)}
                className="studio-secondary-btn"
                style={{ padding: '9px 18px', fontSize: '0.85rem' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="synthesize-cta-btn"
                style={{ padding: '9px 22px', fontSize: '0.85rem' }}
              >
                Save Preset
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  if (systemStatus && systemStatus.state !== 'ready') {
    return (
      <div className="app-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-dark)', padding: '2rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '3rem', marginBottom: '1rem', color: 'var(--text-light)' }}>KyoRenzu Initial Setup</h1>
        <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)', maxWidth: '600px', marginBottom: '2rem' }}>
          Welcome! Before you can use KyoRenzu's AI Discovery engine, we need to download the core dataset (anime database, cover images, and ML embeddings).
        </p>
        
        {systemStatus.state === 'missing' && (
          <button 
            className="action-btn" 
            style={{ fontSize: '1.2rem', padding: '1rem 2rem' }}
            onClick={() => fetch(`${API_BASE}/api/system/download`, {method: 'POST'})}
          >
            Download Dataset (2.6GB)
          </button>
        )}
        
        {(systemStatus.state === 'downloading' || systemStatus.state === 'error') && (
          <div style={{ width: '100%', maxWidth: '600px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: 'var(--text-light)' }}>
              <span>{systemStatus.message}</span>
              <span>{systemStatus.progress}%</span>
            </div>
            <div style={{ width: '100%', height: '8px', background: 'var(--bg-card)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${systemStatus.progress}%`, background: systemStatus.state === 'error' ? '#ef4444' : 'var(--accent-primary)', transition: 'width 0.3s ease' }} />
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="app-container">
      <div className="sr-only">
        KyōRenzu, translated as Resonance Lens, acts as a lens to find the anime that perfectly resonates with your visual, auditory, and narrative preferences.
      </div>
      {/* Top Navigation Header */}
      <header className="top-header">
        <div className="header-container">
          <div className="header-left">
            <div className="menu-toggler" onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}>
              <Menu size={24} />
            </div>
            <div className="brand" onClick={() => setActiveTab('home')} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <div 
                className="brand-logo-circle"
                style={{
                  width: '32px',
                  height: '32px',
                  minWidth: '32px',
                  minHeight: '32px',
                  borderRadius: '50%',
                  aspectRatio: '1 / 1',
                  background: 'var(--accent-ai-gradient)',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 0 14px var(--accent-primary-glow), 0 0 6px var(--accent-ai-glow)',
                }}
              >
                <div style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  background: 'var(--bg-abyss)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="9" stroke="url(#brand_logo_grad)" strokeWidth="2" strokeDasharray="13 4" />
                    <circle cx="12" cy="12" r="4" fill="url(#brand_logo_grad)" />
                    <defs>
                      <linearGradient id="brand_logo_grad" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
                        <stop stopColor="var(--accent-primary)" />
                        <stop offset="1" stopColor="var(--accent-secondary)" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '2px', letterSpacing: '-0.3px', userSelect: 'none' }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 900, fontSize: '1.45rem', fontFamily: "'Nunito', sans-serif" }}>Kyō</span>
                <span style={{ color: 'var(--accent-primary)', fontWeight: 900, fontSize: '1.45rem', fontFamily: "'Nunito', sans-serif" }}>Renzu</span>
                <span style={{ 
                  display: 'inline-block',
                  width: '6px', 
                  height: '6px', 
                  minWidth: '6px',
                  minHeight: '6px',
                  borderRadius: '50%', 
                  background: 'var(--accent-secondary)', 
                  marginLeft: '3px',
                  marginBottom: '2px',
                  boxShadow: '0 0 8px var(--accent-secondary)',
                  flexShrink: 0
                }} />
              </div>
            </div>
            <nav className="header-nav">
              <span className={`nav-link ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}>Home</span>
              <span className={`nav-link ${activeTab === 'search' ? 'active' : ''}`} onClick={() => setActiveTab('search')}>Search</span>
              <span className={`nav-link ${activeTab === 'discover' ? 'active' : ''}`} onClick={() => setActiveTab('discover')}>Discover</span>
              <span className={`nav-link ${activeTab === 'library' ? 'active' : ''}`} onClick={() => setActiveTab('library')}>Library</span>
            </nav>
          </div>
          
          <div className="header-center">
            <div className="header-search-bar">
              <Search size={18} className="search-icon" />
              <input 
                type="text" 
                placeholder="Search anime..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setActiveTab('search');
                  }
                }}
              />
            </div>
          </div>

          <div className="header-right">
            {/* OTA Sync Status Badge */}
            <div 
              className={`header-action ota-sync-action ${isSyncingOta ? 'syncing' : ''}`} 
              title={otaStatus.message || "OTA Database & Multimodal Sync"}
              onClick={triggerOtaSync}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                padding: '4px 10px',
                borderRadius: '8px',
                background: isSyncingOta ? 'rgba(0, 163, 255, 0.18)' : 'var(--bg-glass-subtle)',
                border: isSyncingOta ? '1px solid var(--accent-primary)' : '1px solid var(--border-specular)',
                transition: 'all 0.2s ease',
                marginRight: '4px'
              }}
            >
              <RefreshCw size={14} className={isSyncingOta ? 'spin-animation' : ''} style={{ color: isSyncingOta ? 'var(--accent-secondary)' : 'var(--text-muted)' }} />
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 500,
                color: isSyncingOta ? 'var(--text-primary)' : 'var(--text-secondary)',
                maxWidth: isSyncingOta ? '180px' : '65px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {isSyncingOta ? otaStatus.message : 'OTA Sync'}
              </span>
            </div>

            <div className="header-action" title="Random Anime" onClick={handleRandomAnime}>
              <Shuffle size={20} />
            </div>
            <div className="header-action" title="Watch2Gether" onClick={() => {setToastMessage("Watch2Gether is coming soon!"); setTimeout(() => setToastMessage(null), 3000)}}>
              <Users size={20} />
            </div>
            <div className="header-action notification-bell-container" onClick={() => { setShowNotifications(!showNotifications); if (!showNotifications) markNotificationsRead(); }}>
              <Bell size={20} />
              {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
              {showNotifications && (
                <div className="notification-dropdown" onClick={e => e.stopPropagation()}>
                  <div className="notification-dropdown-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Notifications</span>
                    <button 
                      onClick={(e) => { e.stopPropagation(); triggerOtaSync(); }}
                      disabled={isSyncingOta}
                      style={{
                        background: 'rgba(0, 163, 255, 0.18)',
                        border: '1px solid var(--accent-primary)',
                        color: '#FFFFFF',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.72rem',
                        cursor: isSyncingOta ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <RefreshCw size={12} className={isSyncingOta ? 'spin-animation' : ''} />
                      {isSyncingOta ? 'Syncing...' : 'Sync Catalog'}
                    </button>
                  </div>
                  <div className="notification-list">
                    {notifications.length > 0 ? notifications.map((n, i) => (
                      <div 
                        key={i} 
                        className={`notification-item ${!n.is_read ? 'unread' : ''}`}
                        onClick={() => {
                          setSelectedAnime(n);
                          setShowNotifications(false);
                          if (!n.is_read) {
                            // Optionally mark it as read immediately if it wasn't already caught by the dropdown open event
                            markNotificationsRead();
                          }
                        }}
                      >
                        {n.message}
                        <div className="notification-time">{new Date(n.created_at).toLocaleString()}</div>
                      </div>
                    )) : (
                      <div style={{padding: '16px', textAlign: 'center', color: '#666', fontSize: '0.9rem'}}>No new notifications</div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div 
              className="header-action" 
              title="Color Aesthetics" 
              onClick={() => setShowThemeModal(true)}
              style={{ cursor: 'pointer' }}
            >
              <Palette size={20} />
            </div>
            <div className="header-action user-profile" title="Profile" onClick={() => {setToastMessage("User Profiles coming soon!"); setTimeout(() => setToastMessage(null), 3000)}}>
              <User size={20} />
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {isSidebarExpanded && (
        <div className="mobile-menu-overlay" onClick={() => setIsSidebarExpanded(false)}>
          <div className="mobile-menu-content" onClick={(e) => e.stopPropagation()}>
            <nav className="mobile-nav">
              <div className={`mobile-nav-link ${activeTab === 'home' ? 'active' : ''}`} onClick={() => { setActiveTab('home'); setIsSidebarExpanded(false); }}>
                <Home size={20} /> Home
              </div>
              <div className={`mobile-nav-link ${activeTab === 'search' ? 'active' : ''}`} onClick={() => { setActiveTab('search'); setIsSidebarExpanded(false); }}>
                <Search size={20} /> Search
              </div>
              <div className={`mobile-nav-link ${activeTab === 'discover' ? 'active' : ''}`} onClick={() => { setActiveTab('discover'); setIsSidebarExpanded(false); }}>
                <Compass size={20} /> Discover
              </div>
              <div className={`mobile-nav-link ${activeTab === 'library' ? 'active' : ''}`} onClick={() => { setActiveTab('library'); setIsSidebarExpanded(false); }}>
                <Library size={20} /> My Library
              </div>
              <div className="mobile-nav-link" onClick={() => { setShowThemeModal(true); setIsSidebarExpanded(false); }}>
                <Palette size={20} /> Themes
              </div>
            </nav>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="main-content" style={{ padding: activeTab === 'home' ? '0' : '32px 48px' }}>
        
        {/* HOME LIBRARY VIEW */}
        {activeTab === 'home' && (
          <>
            {libraryLoading ? (
              <div className="loader-container">
                <div className="spinner"></div>
              </div>
            ) : (
              <>
                {/* Hero Banner */}
                {heroAnimes.length > 0 && (
                  <div className="hero-banner">
                    {/* Atmospheric Dynamic Ambilight Cover Glow */}
                    <div 
                      className="hero-ambilight-glow"
                      style={{
                        backgroundImage: `url(${resolveMediaUrl(heroAnimes[currentHeroIndex]?.cover_url || heroAnimes[currentHeroIndex]?.banner_url) || './no_image_cover.jpg'})`
                      }}
                    />
                    {heroAnimes.map((hero: any, idx: number) => (
                      <div key={idx} className={`hero-slide ${idx === currentHeroIndex ? 'active' : ''}`}>
                        {hero.banner_url ? (
                          <img src={hero.banner_url} alt={hero.title} className="hero-banner-image" />
                        ) : (
                          <>
                            <img src={resolveMediaUrl(hero.cover_url) || ''} alt={hero.title} className="hero-bg-blur" />
                            <img src={resolveMediaUrl(hero.cover_url) || ''} alt={hero.title} className="hero-banner-image-contain" />
                          </>
                        )}
                        
                        <div className="hero-overlay">
                          <div className="hero-content">
                            <h1 className="hero-title">{hero.title}</h1>
                            <div className="hero-meta" style={{display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px'}}>
                              <span style={{background: 'var(--accent-primary)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold'}}>HD</span>
                              <span style={{background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px'}}><Type size={12}/> {hero.episodes || '?'}</span>
                              <span style={{background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px'}}><Tv size={12}/> {hero.episodes || '?'}</span>
                              <span style={{color: 'var(--text-secondary)', fontSize: '0.9rem'}}>• {hero.year || 'Unknown Year'}</span>
                            </div>
                            <p className="hero-synopsis" style={{fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '24px', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden'}}>{cleanSynopsis(hero.synopsis)}</p>
                            
                            <div className="hero-actions" style={{display: 'flex', gap: '16px'}}>
                              <button className="btn-primary" style={{display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', fontSize: '1.1rem', fontWeight: '700', borderRadius: '30px'}} onClick={() => playEpisode(hero.title, hero.title_original, 1)}>
                                <Play size={20} fill="currentColor" /> Play Now
                              </button>
                              <button className="btn-secondary" style={{display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', fontSize: '1.1rem', fontWeight: '700', borderRadius: '30px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none'}} onClick={() => setSelectedAnime(hero)}>
                                <Info size={20} /> Details
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="hero-dots" style={{position: 'absolute', bottom: '20px', right: '20px', display: 'flex', gap: '6px', zIndex: 10}}>
                      {heroAnimes.map((_, idx) => (
                        <button 
                          key={idx} 
                          style={{
                            width: idx === currentHeroIndex ? '24px' : '8px', 
                            height: '8px', 
                            borderRadius: '4px', 
                            background: idx === currentHeroIndex ? 'var(--accent-primary)' : 'rgba(255,255,255,0.3)', 
                            border: 'none', 
                            cursor: 'pointer',
                            transition: '0.3s'
                          }}
                          onClick={() => setCurrentHeroIndex(idx)}
                        />
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Full-Width Grid Layout */}
                <div className="anikoto-home-full-layout">
                  {/* Recently Updated & Upcoming Anime Grids */}
                  {categories.filter(cat => ['Recently Updated', 'Upcoming Anime'].includes(cat.category)).map((cat, idx) => (
                    <section key={`cat-${idx}`} className="category-section">
                      <div className="section-head">
                        <h2 className="section-title">{cat.category}</h2>
                        <span className="view-more" onClick={() => setActiveTab('search')} style={{cursor: 'pointer'}}>View more <ArrowDownWideNarrow size={14} /></span>
                      </div>
                      <div className="anime-grid">
                        {cat.anime.slice(0, 18).map((anime: any, aIdx: number) => (
                          <div key={aIdx} className="anikoto-card" onClick={() => setSelectedAnime(anime)}>
                            <div className="poster-container">
                              {anime.cover_url ? (
                                <img src={resolveMediaUrl(anime.cover_url)} alt={anime.title} loading="lazy" />
                              ) : (
                                <div className="anime-card-placeholder">
                                  <ImageIcon size={32} />
                                </div>
                              )}
                              <div className="ep-status-overlay">
                                <span className="ep-sub"><Type size={10} style={{marginRight: '2px'}}/>{anime.episodes || '?'}</span>
                                <span className="ep-dub"><Tv size={10} style={{marginRight: '2px'}}/>HD</span>
                              </div>
                              <div className="poster-hover-details">
                                <h4 className="hover-title">{anime.title}</h4>
                                <div className="hover-meta">
                                  <span>{anime.year || '?'}</span>
                                  <span>•</span>
                                  <span>{anime.episodes ? `${anime.episodes} EPS` : '? EPS'}</span>
                                </div>
                                <div className="hover-play-btn">
                                  <Play size={24} fill="white" color="white" />
                                </div>
                              </div>
                            </div>
                            <div className="card-info">
                              <h3 className="card-title" title={anime.title}>{anime.title}</h3>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}

                  {/* Top Anime (Now a full-width grid instead of sidebar list) */}
                  <section className="category-section">
                    <div className="section-head">
                      <h2 className="section-title">Top Anime</h2>
                      <div className="widget-tabs">
                        <span className={`tab ${topAnimeTab === 'Day' ? 'active' : ''}`} onClick={() => setTopAnimeTab('Day')}>Day</span>
                        <span className={`tab ${topAnimeTab === 'Week' ? 'active' : ''}`} onClick={() => setTopAnimeTab('Week')}>Week</span>
                        <span className={`tab ${topAnimeTab === 'Month' ? 'active' : ''}`} onClick={() => setTopAnimeTab('Month')}>Month</span>
                      </div>
                    </div>
                    <div className="anime-grid">
                      {(categories[topAnimeTab === 'Day' ? 0 : topAnimeTab === 'Week' ? 1 : 2]?.anime || []).slice(0, 18).map((anime: any, idx: number) => (
                        <div key={`top-${idx}`} className="anikoto-card" onClick={() => setSelectedAnime(anime)}>
                          <div className="poster-container">
                            <div className="rank-badge" style={{ position: 'absolute', top: 0, left: 0, background: 'var(--accent-primary)', color: '#ffffff', fontWeight: 'bold', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, borderBottomRightRadius: '8px', fontSize: '1rem' }}>{idx + 1}</div>
                            {anime.cover_url ? (
                              <img src={resolveMediaUrl(anime.cover_url)} alt={anime.title} loading="lazy" />
                            ) : (
                              <div className="anime-card-placeholder"><ImageIcon size={32} /></div>
                            )}
                            <div className="ep-status-overlay">
                              <span className="ep-sub"><Type size={10} style={{marginRight: '2px'}}/>{anime.episodes || '?'}</span>
                              <span className="ep-dub"><Tv size={10} style={{marginRight: '2px'}}/>HD</span>
                            </div>
                            <div className="poster-hover-details">
                              <h4 className="hover-title">{anime.title}</h4>
                              <div className="hover-play-btn"><Play size={24} fill="white" color="white" /></div>
                            </div>
                          </div>
                          <div className="card-info">
                            <h3 className="card-title" title={anime.title}>{anime.title}</h3>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* New Release & Just Completed (Now full-width grids instead of side-by-side tables) */}
                  {categories.filter(cat => ['New Release', 'Just Completed'].includes(cat.category)).map((cat, idx) => (
                    <section key={`table-cat-${idx}`} className="category-section">
                      <div className="section-head">
                        <h2 className="section-title">{cat.category}</h2>
                        <span className="view-more" onClick={() => setActiveTab('search')} style={{cursor: 'pointer'}}>View more <ArrowDownWideNarrow size={14} /></span>
                      </div>
                      <div className="anime-grid">
                        {cat.anime.slice(0, 18).map((anime: any, aIdx: number) => (
                          <div key={aIdx} className="anikoto-card" onClick={() => setSelectedAnime(anime)}>
                            <div className="poster-container">
                              {anime.cover_url ? (
                                <img src={resolveMediaUrl(anime.cover_url)} alt={anime.title} loading="lazy" />
                              ) : (
                                <div className="anime-card-placeholder"><ImageIcon size={32} /></div>
                              )}
                              <div className="ep-status-overlay">
                                <span className="ep-sub"><Type size={10} style={{marginRight: '2px'}}/>{anime.episodes || '?'}</span>
                                <span className="ep-dub"><Tv size={10} style={{marginRight: '2px'}}/>HD</span>
                              </div>
                              <div className="poster-hover-details">
                                <h4 className="hover-title">{anime.title}</h4>
                                <div className="hover-play-btn"><Play size={24} fill="white" color="white" /></div>
                              </div>
                            </div>
                            <div className="card-info">
                              <h3 className="card-title" title={anime.title}>{anime.title}</h3>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* AI DISCOVER VIEW */}
        {activeTab === 'discover' && (
          <>
            <div className="page-header" style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.75rem' }}>
                    <Compass size={26} color="var(--accent-primary)" />
                    AI Discover Studio
                  </h1>
                  <p className="page-subtitle" style={{ fontSize: '0.85rem' }}>
                    Cross-modal aesthetic discovery blending genres, story tropes, and soundtrack vibes.
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button 
                    type="button" 
                    className="studio-secondary-btn"
                    onClick={handleSerendipityRoll}
                    title="Roll randomized high-novelty aesthetic combination"
                    style={{ padding: '8px 14px', fontSize: '0.82rem' }}
                  >
                    <Dices size={15} /> Surprise Me
                  </button>
                  <button 
                    type="button" 
                    className="studio-secondary-btn"
                    onClick={handleSaveCurrentSetup}
                    title="Save current setup as a custom preset"
                    style={{ padding: '8px 14px', fontSize: '0.82rem' }}
                  >
                    <Star size={15} /> + Save Custom Preset
                  </button>
                </div>
              </div>
            </div>

            {/* SYNTHESIS CONSOLE */}
            <div className="discover-studio-card">
              <form onSubmit={(e) => handleDiscoverSubmit(e)}>
                {results.length > 0 && !consoleExpanded ? (
                  /* COMPACT MODE WHEN RESULTS ARE SHOWN */
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.84rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                      <span><strong>Seeds:</strong> {seedChips.length > 0 ? seedChips.map(c => `${c.isNegative ? '-' : '+'}${c.title}`).join(', ') : (useLibraryAsRef ? 'Library Baseline' : 'None (Pure Prompt)')}</span>
                      <span>•</span>
                      <span><strong>Vibe:</strong> {preference || 'Any'}</span>
                      {plotPreference && <><span>•</span><span><strong>Story:</strong> {plotPreference}</span></>}
                      {exclusionMode !== 'none' && <><span>•</span><span style={{ color: 'var(--accent-primary)' }}>✓ {exclusionMode === 'completed' ? 'Completed Hidden' : exclusionMode === 'watching_completed' ? 'Watched Hidden' : 'Library Hidden'}</span></>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button 
                        type="button" 
                        className="studio-secondary-btn" 
                        onClick={() => setConsoleExpanded(true)}
                        style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                      >
                        Adjust Prompts ▾
                      </button>
                      <button 
                        type="submit" 
                        className="synthesize-cta-btn" 
                        disabled={discoverLoading}
                        style={{ padding: '7px 16px', fontSize: '0.82rem' }}
                      >
                        <Sparkles size={13} /> Re-Synthesize
                      </button>
                    </div>
                  </div>
                ) : (
                  /* FULL CONSOLE MODE */
                  <>
                    {/* ROW 1: REFERENCE ANCHORS DECK */}
                    <div className="anchor-deck-container">
                      <div className="anchor-header">
                        <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: 0, fontSize: '0.8rem', letterSpacing: '0.04em' }}>
                          <Star size={13} color="var(--accent-primary)" />
                          <span>REFERENCE TASTE SEEDS</span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                            ({useLibraryAsRef ? `${userLibrary.length} library + ` : ''}{seedChips.length} seeds)
                          </span>
                        </label>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {/* Granular Exclusion Dropdown */}
                          <select
                            value={exclusionMode}
                            onChange={(e: any) => setExclusionMode(e.target.value)}
                            className="studio-select"
                            title="Filter out completed or in-library anime"
                          >
                            <option value="completed" style={{ background: '#111318' }}>Hide Completed</option>
                            <option value="watching_completed" style={{ background: '#111318' }}>Hide Watched & Watching</option>
                            <option value="all_library" style={{ background: '#111318' }}>Hide Entire Library</option>
                            <option value="none" style={{ background: '#111318' }}>Show All (No Exclusions)</option>
                          </select>

                          {/* Use My Library Simultaneous Toggle */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Use Library</span>
                            <div 
                              className={`toggle-switch ${useLibraryAsRef ? 'on' : 'off'}`} 
                              onClick={() => setUseLibraryAsRef(!useLibraryAsRef)}
                              style={{
                                width: '32px', height: '17px', borderRadius: '10px', 
                                background: useLibraryAsRef ? 'var(--accent-primary)' : 'rgba(255,255,255,0.2)',
                                position: 'relative', cursor: 'pointer', transition: '0.3s'
                              }}
                              title="Toggle personal library scoring simultaneously with custom anime seeds"
                            >
                              <div style={{
                                width: '13px', height: '13px', borderRadius: '50%', background: 'white',
                                position: 'absolute', top: '2px', left: useLibraryAsRef ? '17px' : '2px', transition: '0.3s'
                              }} />
                            </div>
                          </div>

                          {results.length > 0 && (
                            <button
                              type="button"
                              className="studio-toggle-link"
                              onClick={() => setConsoleExpanded(false)}
                            >
                              ▲ Minimize
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Interactive Positive / Negative Seed Chips Bar with Autocomplete */}
                      <div style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'rgba(0,0,0,0.22)', border: '1px solid var(--border-specular)', borderRadius: '10px', minHeight: '40px' }}>
                        {useLibraryAsRef && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', border: '1px dashed rgba(255,255,255,0.2)', fontSize: '0.74rem', color: 'var(--accent-primary)' }}>
                            <Library size={11} /> Library Baseline Active
                          </span>
                        )}

                        {seedChips.map(chip => (
                          <span key={chip.title} className={`seed-chip ${chip.isNegative ? 'negative' : 'positive'}`}>
                            <span 
                              className="seed-chip-sign" 
                              onClick={() => toggleSeedChipSign(chip.title)}
                              title={chip.isNegative ? "Negative repulsor (click to toggle positive seed)" : "Positive seed (click to toggle negative repulsor)"}
                            >
                              {chip.isNegative ? '−' : '+'}
                            </span>
                            <span>{chip.title}</span>
                            <span 
                              className="seed-chip-remove" 
                              onClick={() => removeSeedChip(chip.title)}
                              title="Remove seed"
                            >
                              ×
                            </span>
                          </span>
                        ))}

                        <div style={{ position: 'relative', flex: 1, minWidth: '170px' }}>
                          <input
                            type="text"
                            placeholder={seedChips.length === 0 ? "Type anime seed (or leave empty for pure-prompt) and press Enter..." : "+ add seed (+ / -)..."}
                            value={newAnchorInput}
                            onChange={(e) => setNewAnchorInput(e.target.value)}
                            onFocus={() => { if (seedSuggestions.length > 0) setShowSeedSuggestions(true); }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ',') {
                                e.preventDefault();
                                if (newAnchorInput.trim()) {
                                  addSeedChip(newAnchorInput.trim(), false);
                                }
                              }
                            }}
                            style={{ width: '100%', background: 'transparent', border: 'none', color: '#FFFFFF', outline: 'none', fontSize: '0.85rem' }}
                          />

                          {showSeedSuggestions && seedSuggestions.length > 0 && (
                            <div className="seed-suggestions-dropdown">
                              {seedSuggestions.map(s => (
                                <div 
                                  key={s.mal_id} 
                                  className="seed-suggestion-item"
                                  onMouseDown={() => addSeedChip(s.title || s.title_english, false)}
                                >
                                  <span>{s.title || s.title_english}</span>
                                  {s.year && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{s.year}</span>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* ROW 2: 3-COLUMN MULTIMODAL PROMPT MATRIX */}
                    <div className="multimodal-prompt-grid" style={{ marginTop: '12px', gap: '12px' }}>
                      {/* MODALITY 1: GENRES */}
                      <div className="modality-card" style={{ padding: '12px 14px', gap: '6px' }}>
                        <div className="modality-title" style={{ fontSize: '0.78rem' }}>
                          <Tags size={13} color="var(--accent-primary)" />
                          <span>Genres</span>
                        </div>
                        <input
                          type="text"
                          className="modality-input"
                          placeholder="e.g. Action, Cyberpunk, Psychological, Sci-Fi..."
                          value={preference}
                          onChange={(e) => setPreference(e.target.value)}
                          style={{ fontSize: '0.85rem', padding: '5px 0' }}
                        />
                        <div className="prompt-chips-flow">
                          {GENRE_CHIPS.map(chip => (
                            <button
                              key={chip}
                              type="button"
                              className={`prompt-suggestion-chip ${preference.toLowerCase().includes(chip.toLowerCase()) ? 'active' : ''}`}
                              onClick={() => togglePromptChip(chip, preference, setPreference)}
                            >
                              {chip}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* MODALITY 2: PLOT */}
                      <div className="modality-card" style={{ padding: '12px 14px', gap: '6px' }}>
                        <div className="modality-title" style={{ fontSize: '0.78rem' }}>
                          <BookOpen size={13} color="var(--accent-primary)" />
                          <span>Story & Theme</span>
                        </div>
                        <input
                          type="text"
                          className="modality-input"
                          placeholder="e.g. Space bounty hunters, time loop..."
                          value={plotPreference}
                          onChange={(e) => setPlotPreference(e.target.value)}
                          style={{ fontSize: '0.85rem', padding: '5px 0' }}
                        />
                        <div className="prompt-chips-flow">
                          {PLOT_CHIPS.map(chip => (
                            <button
                              key={chip}
                              type="button"
                              className={`prompt-suggestion-chip ${plotPreference.toLowerCase().includes(chip.toLowerCase()) ? 'active' : ''}`}
                              onClick={() => togglePromptChip(chip, plotPreference, setPlotPreference)}
                            >
                              {chip}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* MODALITY 3: AUDIO */}
                      <div className="modality-card" style={{ padding: '12px 14px', gap: '6px' }}>
                        <div className="modality-title" style={{ fontSize: '0.78rem' }}>
                          <Music size={13} color="var(--accent-secondary)" />
                          <span>Acoustic Vibe</span>
                        </div>
                        <input
                          type="text"
                          className="modality-input"
                          placeholder="e.g. Smooth jazz sax, melancholic piano..."
                          value={audioPreference}
                          onChange={(e) => setAudioPreference(e.target.value)}
                          style={{ fontSize: '0.85rem', padding: '5px 0' }}
                        />
                        <div className="prompt-chips-flow">
                          {AUDIO_CHIPS.map(chip => (
                            <button
                              key={chip}
                              type="button"
                              className={`prompt-suggestion-chip ${audioPreference.toLowerCase().includes(chip.toLowerCase()) ? 'active' : ''}`}
                              onClick={() => togglePromptChip(chip, audioPreference, setAudioPreference)}
                            >
                              {chip}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* ROW 3: UNIFIED CONTROL BAR */}
                    <div className="synthesis-control-bar" style={{ marginTop: '14px', paddingTop: '12px' }}>
                      <div className="synthesis-left-controls" style={{ gap: '12px' }}>
                        {/* ERA SELECTION DROPDOWN + CUSTOM ERA */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <CalendarRange size={13} color="var(--text-muted)" />
                          <select 
                            value={eraSelection} 
                            onChange={(e) => setEraSelection(e.target.value)}
                            className="studio-select"
                            title="Filter recommendations by era or year"
                          >
                            <option value="" style={{ background: '#111318' }}>Any Era</option>
                            <option value="1995" style={{ background: '#111318' }}>80s & 90s Retro</option>
                            <option value="2006" style={{ background: '#111318' }}>2000s Classic</option>
                            <option value="2015" style={{ background: '#111318' }}>2010s Hits</option>
                            <option value="2023" style={{ background: '#111318' }}>2020s Modern</option>
                            <option value="custom" style={{ background: '#111318' }}>Custom Year / Range...</option>
                          </select>
                          {eraSelection === 'custom' && (
                            <input
                              type="text"
                              placeholder="e.g. 1998 or 1980-2026"
                              value={customEraInput}
                              onChange={(e) => setCustomEraInput(e.target.value)}
                              style={{ width: '120px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-specular)', borderRadius: '6px', color: '#FFFFFF', padding: '4px 8px', fontSize: '0.75rem' }}
                            />
                          )}
                        </div>

                        {/* COUNT SELECTION */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Filter size={13} color="var(--text-muted)" />
                          <div className="quick-pills-wrapper">
                            {[12, 24, 48].map(cnt => (
                              <button
                                key={cnt}
                                type="button"
                                className={`quick-pill-btn ${numRecommendations === cnt ? 'active' : ''}`}
                                onClick={() => setNumRecommendations(cnt)}
                                style={{ padding: '4px 9px', fontSize: '0.74rem' }}
                              >
                                {cnt}
                              </button>
                            ))}
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={numRecommendations}
                              onChange={(e) => setNumRecommendations(Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 12)))}
                              className="studio-number-input"
                              title="Custom result count (1-100)"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="synthesis-right-controls" style={{ gap: '8px' }}>
                        <button
                          type="button"
                          className={`quick-pill-btn ${showTuningDrawer ? 'active' : ''}`}
                          onClick={() => setShowTuningDrawer(!showTuningDrawer)}
                          title="Toggle neural weights & hard filters"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 11px', fontSize: '0.78rem' }}
                        >
                          <Sliders size={12} />
                          AI Weights & Filters
                        </button>
                        <button
                          type="button"
                          className="quick-pill-btn"
                          onClick={handleSaveCurrentSetup}
                          title="Save current prompts and weights as a custom preset"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 11px', fontSize: '0.78rem' }}
                        >
                          <Star size={12} />
                          Save Preset
                        </button>
                        <button
                          type="submit"
                          className="synthesize-cta-btn"
                          disabled={discoverLoading}
                          style={{ padding: '8px 20px', fontSize: '0.88rem' }}
                        >
                          <Sparkles size={15} />
                          {discoverLoading ? 'Synthesizing...' : 'Synthesize Resonance'}
                        </button>
                      </div>
                    </div>

                    {/* EXPANDABLE AI WEIGHT & HARD FILTERS DRAWER */}
                    {showTuningDrawer && (
                      <div className="tuning-drawer-panel" style={{ marginTop: '14px', padding: '14px 18px', gap: '14px' }}>
                        {/* 4 NEURAL SLIDERS */}
                        <div className="slider-control-item">
                          <div className="slider-label-row">
                            <span>Genre Resonance Weight (CLIP)</span>
                            <span className="slider-value-badge">{Math.round(visualWeight * 100)}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={visualWeight}
                            onChange={(e) => setVisualWeight(parseFloat(e.target.value))}
                            className="studio-range-slider"
                          />
                        </div>

                        <div className="slider-control-item">
                          <div className="slider-label-row">
                            <span>Story Narrative Weight (MiniLM)</span>
                            <span className="slider-value-badge">{Math.round(plotWeight * 100)}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={plotWeight}
                            onChange={(e) => setPlotWeight(parseFloat(e.target.value))}
                            className="studio-range-slider"
                          />
                        </div>

                        <div className="slider-control-item">
                          <div className="slider-label-row">
                            <span>Acoustic Vibe Weight (CLAP)</span>
                            <span className="slider-value-badge">{Math.round(audioWeight * 100)}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={audioWeight}
                            onChange={(e) => setAudioWeight(parseFloat(e.target.value))}
                            className="studio-range-slider"
                          />
                        </div>

                        <div className="slider-control-item">
                          <div className="slider-label-row">
                            <span>Novelty / Discovery Horizon</span>
                            <span className="slider-value-badge">
                              {diversityLambda >= 0.75 ? 'Safe & Familiar' : diversityLambda <= 0.55 ? 'Bold & Adventurous' : 'Balanced (0.68)'}
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0.45"
                            max="0.85"
                            step="0.05"
                            value={diversityLambda}
                            onChange={(e) => setDiversityLambda(parseFloat(e.target.value))}
                            className="studio-range-slider"
                          />
                        </div>

                        {/* HARD METADATA FILTERS */}
                        <div className="slider-control-item">
                          <div className="slider-label-row">
                            <span>Minimum MAL Score</span>
                            <span className="slider-value-badge">{minScoreFilter > 0 ? `${minScoreFilter.toFixed(1)}+` : 'Any'}</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="8.5"
                            step="0.5"
                            value={minScoreFilter}
                            onChange={(e) => setMinScoreFilter(parseFloat(e.target.value))}
                            className="studio-range-slider"
                          />
                        </div>

                        <div className="slider-control-item">
                          <div className="slider-label-row">
                            <span>Format</span>
                            <span className="slider-value-badge">{formatFilter}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                            {(['ALL', 'TV', 'MOVIE', 'OVA'] as const).map(fmt => (
                              <button
                                key={fmt}
                                type="button"
                                className={`quick-pill-btn ${formatFilter === fmt ? 'active' : ''}`}
                                onClick={() => setFormatFilter(fmt)}
                                style={{ padding: '3px 8px', fontSize: '0.72rem', flex: 1 }}
                              >
                                {fmt}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* GENRE EXCLUDE */}
                        <div style={{ gridColumn: '1 / -1', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                          <label style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <FilterX size={12} color="var(--accent-secondary)" />
                            <span>Exclude Genres (comma-separated):</span>
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Harem, Ecchi, Kids..."
                            value={genresExcludeInput}
                            onChange={(e) => setGenresExcludeInput(e.target.value)}
                            style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-specular)', borderRadius: '6px', color: '#FFFFFF', padding: '6px 10px', fontSize: '0.8rem', marginTop: '4px' }}
                          />
                        </div>

                        {/* NEGATIVE REPULSOR & RESET */}
                        <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '240px' }}>
                            <FilterX size={13} color="var(--accent-secondary)" />
                            <input
                              type="text"
                              placeholder="Negative repulsor titles (e.g. Bleach, Naruto)..."
                              value={negativeAnimeInput}
                              onChange={(e) => setNegativeAnimeInput(e.target.value)}
                              style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-specular)', borderRadius: '6px', color: '#FFFFFF', padding: '5px 8px', fontSize: '0.8rem' }}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={resetWeightsToDefault}
                            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-specular)', color: 'var(--text-secondary)', padding: '5px 10px', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                          >
                            <RefreshCw size={11} /> Reset Defaults
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {error && (
                  <div style={{ marginTop: '12px', padding: '8px 12px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: '8px', color: '#fca5a5', fontSize: '0.82rem' }}>
                    {error}
                  </div>
                )}
              </form>
            </div>

            {/* CURATED & CUSTOM AESTHETIC PRESETS (ZERO STATE - WHEN NO RESULTS YET) */}
            {results.length === 0 && !discoverLoading && (
              <div className="vibe-matrix-section">
                <div className="vibe-matrix-header">
                  <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.15rem', margin: 0 }}>
                    <Sparkles size={18} color="var(--accent-primary)" />
                    Curated Aesthetic Presets
                  </h2>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                    1-Click multimodal neural synthesis
                  </span>
                </div>
                
                <div className="vibe-matrix-grid">
                  {/* Personal Custom Presets */}
                  {customPresets.map((preset) => (
                    <div
                      key={preset.id}
                      className="vibe-preset-card"
                      onClick={() => handleApplyCustomPreset(preset)}
                      title={`Custom preset: ${preset.title}`}
                    >
                      <div className="vibe-preset-title-row">
                        <span className="vibe-preset-title">{preset.title}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className="vibe-preset-badge" style={{ color: 'var(--accent-primary)', borderColor: 'var(--accent-primary)' }}>
                            ★ {preset.badge}
                          </span>
                          <button
                            type="button"
                            className="custom-preset-delete-btn"
                            onClick={(e) => handleDeleteCustomPreset(e, preset.id)}
                            title="Delete custom preset"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                      
                      <div className="vibe-preset-desc">
                        {preset.description}
                      </div>

                      <div className="vibe-preset-cta">
                        <span>Load Custom Setup</span>
                        <Sparkles size={13} />
                      </div>
                    </div>
                  ))}

                  {/* 8 Curated Theme Presets */}
                  {CURATED_AESTHETICS.map((preset, idx) => (
                    <div
                      key={idx}
                      className="vibe-preset-card"
                      onClick={() => handleApplyPreset(preset)}
                    >
                      <div className="vibe-preset-title-row">
                        <span className="vibe-preset-title">{preset.title}</span>
                        <span className="vibe-preset-badge">
                          {preset.badge}
                        </span>
                      </div>
                      
                      <div className="vibe-preset-desc">
                        {preset.description}
                      </div>

                      <div className="vibe-preset-cta">
                        <span>Synthesize Recipe</span>
                        <Sparkles size={13} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SYNTHESIZED RESULTS */}
            <div className="results-section">
              {results.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                  <h2 className="section-title" style={{ margin: 0 }}>
                    <Sparkles size={20} color="var(--accent-primary)"/> Synthesized Recommendations ({results.length})
                  </h2>
                  <button
                    type="button"
                    className="studio-secondary-btn"
                    onClick={() => setResults([])}
                    style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                  >
                    Clear Results
                  </button>
                </div>
              )}
              
              {discoverLoading ? (
                <div className="loader-container">
                  <div className="spinner"></div>
                  <p style={{ marginTop: '16px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    Synthesizing cross-modal vectors & calculating MMR diversity...
                  </p>
                </div>
              ) : results.length > 0 ? (
                <div className="anime-grid">
                  {results.map((anime, idx) => {
                    const overallPct = Math.round((anime.similarity || 0) * 100);
                    const visPct = Math.round((anime.visual_similarity ?? anime.similarity ?? 0) * 100);
                    const plotPct = anime.plot_similarity != null ? Math.round(anime.plot_similarity * 100) : null;
                    const audioPct = anime.audio_similarity != null ? Math.round(anime.audio_similarity * 100) : null;
                    const tierClass = getTasteBadgeTierClass(overallPct);

                    return (
                      <div key={anime.mal_id || idx} className="anikoto-card" onClick={() => setSelectedAnime(anime)}>
                        <div className="poster-container">
                          <div className="rank-badge" style={{ position: 'absolute', top: 0, left: 0, background: 'var(--accent-primary)', color: '#ffffff', fontWeight: 'bold', padding: '4px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, borderBottomRightRadius: '8px', fontSize: '0.88rem' }}>
                            #{anime.rank || idx + 1}
                          </div>
                          
                          <div 
                            className={`taste-match-badge ${tierClass}`}
                            style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 10, padding: '3px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 800 }}
                          >
                            {overallPct}%
                          </div>
                          
                          {anime.cover_url ? (
                            <img src={resolveMediaUrl(anime.cover_url)} alt={anime.title} loading="lazy" />
                          ) : (
                            <div className="anime-card-placeholder">
                              <ImageIcon size={32} />
                            </div>
                          )}
                          
                          <div className="ep-status-overlay">
                            <span className="ep-sub"><Type size={10} style={{marginRight: '2px'}}/>{anime.episodes || '?'}</span>
                            {anime.score && <span className="ep-dub" style={{background: 'rgba(0,0,0,0.8)'}}><Star size={10} fill="gold" color="gold" style={{marginRight: '2px'}}/>{anime.score.toFixed(1)}</span>}
                          </div>
                          
                          <div className="poster-hover-details">
                            <h4 className="hover-title">{anime.title}</h4>
                            <div className="hover-meta">
                              <span>{anime.year || '?'}</span>
                              <span>•</span>
                              <span>{anime.episodes === 1 ? 'Movie' : (anime.episodes ? `${anime.episodes} EPS` : '? EPS')}</span>
                            </div>

                            {/* Match Diagnostic Badge */}
                            {anime.match_reason ? (
                              <div className="match-reason-badge">
                                <Sparkles size={11} color="var(--accent-primary)" />
                                <span>{anime.match_reason}</span>
                              </div>
                            ) : (
                              <div style={{fontSize: '0.82rem', color: 'var(--accent-primary)', marginBottom: '8px', fontWeight: 700}}>
                                {overallPct}% Multimodal Match
                              </div>
                            )}

                            {/* Multimodal DNA Bars */}
                            <div className="multimodal-dna-bars">
                              <div className="dna-meter-row">
                                <span>Visual</span>
                                <span>{visPct}%</span>
                              </div>
                              <div className="dna-meter-bar">
                                <div className="dna-meter-fill" style={{ width: `${Math.min(100, Math.max(5, visPct))}%` }} />
                              </div>

                              {plotPct !== null && (
                                <>
                                  <div className="dna-meter-row" style={{ marginTop: '4px' }}>
                                    <span>Narrative</span>
                                    <span>{plotPct}%</span>
                                  </div>
                                  <div className="dna-meter-bar">
                                    <div className="dna-meter-fill" style={{ width: `${Math.min(100, Math.max(5, plotPct))}%`, background: 'var(--accent-primary)' }} />
                                  </div>
                                </>
                              )}

                              {audioPct !== null && (
                                <>
                                  <div className="dna-meter-row" style={{ marginTop: '4px' }}>
                                    <span>Acoustic</span>
                                    <span>{audioPct}%</span>
                                  </div>
                                  <div className="dna-meter-bar">
                                    <div className="dna-meter-fill" style={{ width: `${Math.min(100, Math.max(5, audioPct))}%`, background: 'var(--accent-secondary)' }} />
                                  </div>
                                </>
                              )}
                            </div>

                            {/* Action Buttons Row */}
                            <div className="card-quick-actions-row">
                              <button 
                                type="button" 
                                className="card-quick-action-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  playVideo(anime.title, anime.theme_url);
                                }}
                                title="Play theme song or trailer"
                              >
                                <Play size={11} fill="white" /> Play
                              </button>
                              <button 
                                type="button" 
                                className="card-quick-action-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  addToLibrary(anime, 'Plan to Watch');
                                }}
                                title="Add to Plan to Watch"
                              >
                                <Plus size={11} /> Plan
                              </button>
                              <button 
                                type="button" 
                                className="card-quick-action-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  seedAsAnchor(anime);
                                }}
                                title="Seed as reference anchor and re-synthesize"
                              >
                                <Target size={11} /> Seed
                              </button>
                            </div>
                          </div>
                        </div>
                        <div className="card-info">
                          <h3 className="card-title" title={anime.title}>{anime.title}</h3>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </>
        )}
        
        {/* USER LIBRARY VIEW */}
        {activeTab === 'library' && (
          <div className="user-library-page">
            {/* Profile Header */}
            <div className="profile-header">
              <div 
                className="profile-avatar"
                style={{
                  width: '96px',
                  height: '96px',
                  minWidth: '96px',
                  minHeight: '96px',
                  maxWidth: '96px',
                  maxHeight: '96px',
                  borderRadius: '50%',
                  aspectRatio: '1 / 1',
                  flexShrink: 0,
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'linear-gradient(135deg, rgba(0, 163, 255, 0.25) 0%, rgba(255, 42, 133, 0.25) 100%)',
                  border: '2px solid var(--accent-primary)',
                  boxShadow: '0 0 0 4px rgba(0, 163, 255, 0.15), 0 0 24px rgba(0, 163, 255, 0.35)',
                }}
              >
                <img 
                  src={`https://ui-avatars.com/api/?name=${encodeURIComponent(userName || 'Guest')}&background=00A3FF&color=fff&size=128&bold=true&rounded=true`} 
                  alt={userName || 'Guest'} 
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    display: 'block'
                  }}
                />
              </div>
              <div className="profile-info">
                <h1 className="profile-name">{userName || 'Guest'}</h1>
                <span className="profile-rank">
                  {userLibrary.filter(item => item.status === 'Completed').length < 10 ? 'Newbie' :
                   userLibrary.filter(item => item.status === 'Completed').length < 50 ? 'Casual Watcher' :
                   userLibrary.filter(item => item.status === 'Completed').length < 150 ? 'Otaku' :
                   userLibrary.filter(item => item.status === 'Completed').length < 300 ? 'Anime Sage' : 'Anime God'}
                </span>
                
                <div className="profile-stats">
                  <div className="stat"><span>Mana</span> <strong>{userLibrary.reduce((acc, item) => (item.status === 'Watching' || item.status === 'Completed') ? acc + (item.episodes_watched || 0) : acc, 0)}</strong></div>
                  <div className="stat"><span>Join date</span> <strong>Jun 14, 2026</strong></div>
                  <div className="stat"><span>Watch list</span> <strong>{userLibrary.length}</strong></div>
                  <div className="stat" style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                    <span>Completed Anime</span> 
                    <strong>{userLibrary.filter(item => item.status === 'Completed').length}</strong>
                    <button onClick={calculateUniqueAnime} style={{background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer'}}>Unique</button>
                  </div>
                </div>
              </div>
              
              <div className="profile-actions" style={{ marginLeft: 'auto', display: 'flex', gap: '12px', alignItems: 'center' }}>
                <button 
                  className={`btn-secondary ${isBatchMode ? 'active' : ''}`}
                  onClick={() => {
                    setIsBatchMode(!isBatchMode);
                    if (isBatchMode) setSelectedMalIds([]);
                  }}
                  style={isBatchMode ? { background: 'rgba(0, 163, 255, 0.22)', borderColor: 'var(--accent-primary)', color: 'white' } : {}}
                >
                  <CheckSquare size={16} style={{marginRight:'6px'}} /> {isBatchMode ? 'Exit Batch' : 'Batch Edit'}
                </button>
                <button className="btn-secondary" onClick={() => setShowStatsModal(true)}>
                  <BarChart2 size={16} style={{marginRight:'6px'}} /> View Stats
                </button>
                <button className="btn-secondary" onClick={() => window.location.href = `${API_BASE}/api/library/export?format=csv`}>
                  <Download size={16} style={{marginRight:'6px'}} /> Export CSV
                </button>
                <button className="btn-secondary" onClick={() => window.location.href = `${API_BASE}/api/library/export?format=xml`}>
                  <Download size={16} style={{marginRight:'6px'}} /> Export XML
                </button>
                <button className="btn-primary" onClick={() => setShowImportModal(true)}>
                  <Upload size={16} style={{marginRight:'6px'}} /> Import
                </button>
                <input type="file" accept=".xml,.csv" style={{ display: 'none' }} ref={fileInputRef} onChange={handleImportChange} />
              </div>
            </div>

            {/* Import Modal */}
            {showImportModal && (
              <div className="import-modal-overlay">
                <div className="import-modal-card">
                  <button className="import-modal-close" onClick={() => { setShowImportModal(false); setImportFile(null); }}>
                    <X size={20} />
                  </button>
                  
                  <h2 style={{ marginBottom: '8px', color: 'white', fontSize: '1.5rem' }}>Import Library</h2>
                  <p style={{ color: 'var(--text-secondary)' }}>Restore your library from MyAnimeList XML or KyōRenzu CSV.</p>

                  {!importFile ? (
                    <div 
                      className={`import-dropzone ${isDragging ? 'active' : ''}`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="import-icon" size={48} />
                      <h3 style={{ color: 'white', marginBottom: '8px' }}>Click or drag file to this area</h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Supports .xml and .csv files</p>
                    </div>
                  ) : (
                    <div className="import-confirm-box">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '16px' }}>
                        <div style={{ background: 'var(--accent-primary)', padding: '8px', borderRadius: '8px' }}>
                          <Upload size={24} color="white" />
                        </div>
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ color: 'white', fontWeight: 'bold' }}>{importFile.name}</div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Ready to import</div>
                        </div>
                      </div>
                      
                      <p style={{ marginBottom: '24px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        Would you like to overwrite your existing library, or merge these items?
                      </p>
                      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                        <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setImportFile(null)}>Change File</button>
                        <button className="btn-primary" style={{ flex: 1 }} onClick={() => processImport(false)}>Merge</button>
                        <button className="btn-primary" style={{ background: '#ef4444', flex: 1 }} onClick={() => processImport(true)}>Overwrite</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Status Tabs */}
            <div className="library-tabs">
              {['All', 'Watching', 'On-Hold', 'Planned', 'Dropped', 'Completed'].map(status => (
                <button 
                  key={status}
                  className={`library-tab ${userLibraryStatusFilter === status ? 'active' : ''}`}
                  onClick={() => setUserLibraryStatusFilter(status)}
                >
                  {status}
                </button>
              ))}
            </div>

            {/* Filter Bar */}
            <div className="library-filters">
              <input type="text" placeholder="Search by title, genre, notes..." className="filter-input" value={librarySearch} onChange={e => setLibrarySearch(e.target.value)} />
              
              <button 
                className={`filter-btn ${libraryFavoritesOnly ? 'active' : ''}`}
                style={libraryFavoritesOnly ? { background: 'rgba(255, 45, 149, 0.22)', borderColor: '#FF2D95', color: '#FF2D95' } : {}}
                onClick={() => setLibraryFavoritesOnly(!libraryFavoritesOnly)}
              >
                <Star size={14} fill={libraryFavoritesOnly ? '#FF2D95' : 'none'} style={{ marginRight: '6px' }} />
                Favorites Only
              </button>

              <select className="filter-select" value={libraryGenre} onChange={e => setLibraryGenre(e.target.value)}>
                <option value="">All Genres</option>
                <option value="Action">Action</option>
                <option value="Adventure">Adventure</option>
                <option value="Comedy">Comedy</option>
                <option value="Drama">Drama</option>
                <option value="Fantasy">Fantasy</option>
                <option value="Horror">Horror</option>
                <option value="Mecha">Mecha</option>
                <option value="Mystery">Mystery</option>
                <option value="Romance">Romance</option>
                <option value="Sci-Fi">Sci-Fi</option>
                <option value="Slice of Life">Slice of Life</option>
                <option value="Sports">Sports</option>
                <option value="Supernatural">Supernatural</option>
                <option value="Thriller">Thriller</option>
              </select>
              
              <select className="filter-select" value={librarySeason} onChange={e => setLibrarySeason(e.target.value)}>
                <option value="">All Seasons</option>
                <option value="Winter">Winter</option>
                <option value="Spring">Spring</option>
                <option value="Summer">Summer</option>
                <option value="Fall">Fall</option>
              </select>
              
              <select className="filter-select" value={libraryYear} onChange={e => setLibraryYear(e.target.value)}>
                <option value="">All Years</option>
                {Array.from({length: 30}, (_, i) => new Date().getFullYear() - i).map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>

              <div style={{ display: 'flex', alignItems: 'center' }}>
                <select 
                  className="filter-select" 
                  style={{ borderRight: 'none', borderTopRightRadius: 0, borderBottomRightRadius: 0, paddingRight: '8px' }} 
                  value={libraryScoreCondition} 
                  onChange={e => setLibraryScoreCondition(e.target.value)}
                >
                  <option value=">=">≥</option>
                  <option value="<=">≤</option>
                  <option value="=">=</option>
                </select>
                <input 
                  type="number" 
                  className="filter-select" 
                  style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, width: '90px', paddingLeft: '8px' }} 
                  placeholder="Score" 
                  min="0" max="10" 
                  value={libraryScore} 
                  onChange={e => setLibraryScore(e.target.value)}
                />
              </div>
              
              <select className="filter-select" value={librarySort} onChange={e => setLibrarySort(e.target.value)}>
                <option value="updated_desc">Recently Updated</option>
                <option value="taste_match_desc">✨ AI Taste Match %</option>
                <option value="user_score_desc">My Score (High - Low)</option>
                <option value="global_score_desc">Global Score (High - Low)</option>
                <option value="progress_desc">Episodes Watched</option>
                <option value="title_asc">Title (A-Z)</option>
                <option value="title_desc">Title (Z-A)</option>
              </select>

              <button className="filter-btn" onClick={() => {
                setLibrarySearch('');
                setLibraryFavoritesOnly(false);
                setLibraryGenre('');
                setLibrarySeason('');
                setLibraryYear('');
                setLibraryScore('');
                setLibraryScoreCondition('>=');
                setLibrarySort('updated_desc');
              }}>Clear Filters</button>

              <div className="view-toggle">
                <button className={`view-toggle-btn ${libraryViewMode === 'grid' ? 'active' : ''}`} onClick={() => setLibraryViewMode('grid')} title="Grid View"><LayoutGrid size={16} /></button>
                <button className={`view-toggle-btn ${libraryViewMode === 'list' ? 'active' : ''}`} onClick={() => setLibraryViewMode('list')} title="List View"><List size={16} /></button>
              </div>
            </div>

            {/* View Mode Rendering */}
            {userLibraryLoading ? (
               <div className="loader-container"><div className="spinner"></div></div>
            ) : (() => {
              const filteredAndSorted = userLibrary
                .filter(item => userLibraryStatusFilter === 'All' || item.status === userLibraryStatusFilter || (userLibraryStatusFilter === 'Planned' && item.status === 'Plan to Watch'))
                .filter(item => !libraryFavoritesOnly || item.is_favorite === 1)
                .filter(item => {
                  if (!librarySearch) return true;
                  const q = librarySearch.toLowerCase();
                  const matchTitle = fuzzyMatchTitle(librarySearch, item.title, item.title_english);
                  const matchGenre = item.genres && item.genres.toLowerCase().includes(q);
                  const matchNotes = item.notes && item.notes.toLowerCase().includes(q);
                  return matchTitle || matchGenre || matchNotes;
                })
                .filter(item => !libraryGenre || (item.genres && item.genres.includes(libraryGenre)))
                .filter(item => !librarySeason || (item.season && item.season === librarySeason))
                .filter(item => !libraryYear || (item.year && item.year.toString() === libraryYear))
                .filter(item => {
                  if (!libraryScore) return true;
                  if (!item.score) return false;
                  const val = parseInt(libraryScore);
                  if (libraryScoreCondition === '>=') return item.score >= val;
                  if (libraryScoreCondition === '<=') return item.score <= val;
                  if (libraryScoreCondition === '=') return item.score === val;
                  return true;
                })
                .sort((a, b) => {
                  if (librarySort === 'taste_match_desc') return (b.taste_match_pct || 0) - (a.taste_match_pct || 0);
                  if (librarySort === 'updated_desc') return (b.updated_at || 0) - (a.updated_at || 0);
                  if (librarySort === 'user_score_desc') return (b.score || 0) - (a.score || 0);
                  if (librarySort === 'global_score_desc') return (b.global_score || 0) - (a.global_score || 0);
                  if (librarySort === 'progress_desc') return (b.episodes_watched || 0) - (a.episodes_watched || 0);
                  
                  const titleA = a.title_english || a.title || "";
                  const titleB = b.title_english || b.title || "";
                  
                  if (librarySort === 'title_asc') return titleA.localeCompare(titleB);
                  if (librarySort === 'title_desc') return titleB.localeCompare(titleA);
                  
                  return 0;
                });
                
              const totalPages = Math.ceil(filteredAndSorted.length / LIBRARY_ITEMS_PER_PAGE) || 1;
              const pagedItems = filteredAndSorted.slice((libraryPage - 1) * LIBRARY_ITEMS_PER_PAGE, libraryPage * LIBRARY_ITEMS_PER_PAGE);

              const renderPagination = () => {
                if (totalPages <= 1) return null;
                
                const pages = [];
                if (totalPages <= 7) {
                  for (let i = 1; i <= totalPages; i++) pages.push(i);
                } else {
                  if (libraryPage <= 4) {
                    for (let i = 1; i <= 5; i++) pages.push(i);
                    pages.push('...', totalPages - 1, totalPages);
                  } else if (libraryPage >= totalPages - 3) {
                    pages.push(1, 2, '...');
                    for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
                  } else {
                    pages.push(1, 2, '...', libraryPage - 1, libraryPage, libraryPage + 1, '...', totalPages - 1, totalPages);
                  }
                }
                
                return (
                  <div className="pagination-container" style={{ display: 'flex', justifyContent: 'center', marginTop: '20px', gap: '4px', background: 'var(--bg-card)', padding: '10px', borderRadius: '8px', width: 'fit-content', margin: '20px auto' }}>
                    <button 
                      onClick={() => setLibraryPage(p => Math.max(1, p - 1))}
                      disabled={libraryPage === 1}
                      style={{ padding: '6px 12px', background: 'transparent', border: 'none', color: libraryPage === 1 ? 'var(--text-muted)' : 'var(--text-primary)', cursor: libraryPage === 1 ? 'not-allowed' : 'pointer' }}
                    >‹</button>
                    
                    {pages.map((p, i) => (
                      <button
                        key={i}
                        onClick={() => typeof p === 'number' && setLibraryPage(p)}
                        disabled={p === '...'}
                        style={{
                          padding: '6px 12px',
                          background: p === libraryPage ? 'var(--accent-primary)' : 'transparent',
                          color: p === libraryPage ? 'white' : 'var(--text-primary)',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: p === '...' ? 'default' : 'pointer'
                        }}
                      >{p}</button>
                    ))}
                    
                    <button 
                      onClick={() => setLibraryPage(p => Math.min(totalPages, p + 1))}
                      disabled={libraryPage === totalPages}
                      style={{ padding: '6px 12px', background: 'transparent', border: 'none', color: libraryPage === totalPages ? 'var(--text-muted)' : 'var(--text-primary)', cursor: libraryPage === totalPages ? 'not-allowed' : 'pointer' }}
                    >›</button>
                  </div>
                );
              };

              return (
                <>
                  <div className={libraryViewMode === 'list' ? 'library-list' : 'anime-grid'} style={libraryViewMode === 'grid' ? { padding: '16px' } : {}}>
                    {pagedItems.map((item, idx) => {
                      const totalEps = (item.total_episodes && item.total_episodes > 0) ? item.total_episodes : null;
                      const isCompleted = item.status === 'Completed' || (totalEps !== null && (item.episodes_watched || 0) >= totalEps);
                      const nextEp = totalEps 
                        ? Math.min(Math.max(1, (item.episodes_watched || 0) + 1), totalEps)
                        : Math.max(1, (item.episodes_watched || 0) + 1);
                      const isSelected = selectedMalIds.includes(item.mal_id);
                      if (libraryViewMode === 'list') {
                        return (
                          <div 
                            key={item.mal_id || idx} 
                            className={`library-list-item ${isSelected ? 'selected' : ''}`}
                            onClick={() => {
                              if (isBatchMode) {
                                setSelectedMalIds(prev => prev.includes(item.mal_id) ? prev.filter(id => id !== item.mal_id) : [...prev, item.mal_id]);
                              } else {
                                setSelectedAnime(item);
                              }
                            }}
                            style={isSelected ? { outline: '2px solid var(--accent-primary)', background: 'rgba(0, 163, 255, 0.16)' } : {}}
                          >
                            {isBatchMode && (
                              <div 
                                className={`library-card-checkbox ${isSelected ? 'selected' : ''}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedMalIds(prev => prev.includes(item.mal_id) ? prev.filter(id => id !== item.mal_id) : [...prev, item.mal_id]);
                                }}
                              >
                                {isSelected && <Check size={14} color="white" />}
                              </div>
                            )}
                            <div className="library-item-cover-wrapper">
                              <div className="library-item-cover-placeholder">
                                <ImageIcon size={20} opacity={0.35} />
                              </div>
                              {item.cover_url ? (
                                <img 
                                  src={resolveMediaUrl(item.cover_url)} 
                                  alt="" 
                                  className="library-item-cover" 
                                  loading="lazy" 
                                  decoding="async" 
                                  onError={(e) => {
                                    (e.currentTarget as HTMLElement).style.display = 'none';
                                  }}
                                />
                              ) : null}
                              {item.status === 'Watching' && (
                                <button 
                                  className="quick-add-btn" 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    quickAddEpisode(item.mal_id, item.episodes_watched || 0, item.total_episodes);
                                  }}
                                  title="Watched another episode"
                                >
                                  +1
                                </button>
                              )}
                            </div>
                            <div className="library-item-details" style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                <h3 className="library-item-title">{item.title}</h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                  {item.taste_match_pct !== undefined && item.taste_match_pct > 0 && (
                                    <span className={`taste-badge ${getTasteBadgeTierClass(item.taste_match_pct)}`} title="AI Taste Match">
                                      <Sparkles size={11} /> {item.taste_match_pct}% Match
                                    </span>
                                  )}
                                  <button
                                    className={`library-fav-btn ${item.is_favorite ? 'favorited' : ''}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleFavorite(item.mal_id, item.is_favorite || 0);
                                    }}
                                    title={item.is_favorite ? "Remove from favorites" : "Mark as favorite"}
                                  >
                                    <Star size={14} fill={item.is_favorite ? '#FF2D95' : 'none'} color={item.is_favorite ? '#FF2D95' : 'currentColor'} />
                                  </button>
                                  <button 
                                    className="library-play-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      playEpisode(item.title, item.title_original || null, nextEp, item.mal_id);
                                    }}
                                    title={isCompleted ? `Replay Episode ${nextEp}` : `Play Episode ${nextEp}`}
                                  >
                                    <Play size={11} fill="currentColor" /> Ep {nextEp}
                                  </button>
                                </div>
                              </div>
                              <div className="library-item-meta">
                                <span className={`status-dot ${item.status.toLowerCase().replace(' ', '-')}`}></span>
                                <span>{item.status}</span>
                                <span className="meta-divider">•</span>
                                <span>{item.episodes_watched} / {item.total_episodes || '?'} EPS</span>
                                {item.unwatched_aired_episodes !== undefined && item.unwatched_aired_episodes > 0 && item.status === 'Watching' && (
                                  <>
                                    <span className="meta-divider">•</span>
                                    <span style={{ color: '#0096C7', fontWeight: 600 }}>{item.unwatched_aired_episodes} new ep{item.unwatched_aired_episodes > 1 ? 's' : ''}</span>
                                  </>
                                )}
                                {item.score > 0 && (
                                  <>
                                    <span className="meta-divider">•</span>
                                    <span style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }} title="My Score">My ★ {item.score}</span>
                                  </>
                                )}
                                {item.global_score > 0 && (
                                  <>
                                    <span className="meta-divider">•</span>
                                    <span style={{ color: 'var(--text-secondary)' }} title="MAL Global Score">MAL ★ {item.global_score.toFixed(2)}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      } else {
                        // Grid View rendering
                        return (
                          <div 
                            key={item.mal_id || idx} 
                            className={`anikoto-card ${isSelected ? 'selected' : ''}`}
                            onClick={() => {
                              if (isBatchMode) {
                                setSelectedMalIds(prev => prev.includes(item.mal_id) ? prev.filter(id => id !== item.mal_id) : [...prev, item.mal_id]);
                              } else {
                                setSelectedAnime(item);
                              }
                            }}
                            style={isSelected ? { outline: '2px solid var(--accent-primary)', transform: 'translateY(-2px)' } : {}}
                          >
                            <div className="poster-container">
                              {isBatchMode && (
                                <div 
                                  className={`library-card-checkbox ${isSelected ? 'selected' : ''}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedMalIds(prev => prev.includes(item.mal_id) ? prev.filter(id => id !== item.mal_id) : [...prev, item.mal_id]);
                                  }}
                                >
                                  {isSelected && <Check size={14} color="white" />}
                                </div>
                              )}
                              <div className="anime-card-placeholder" style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
                                <ImageIcon size={32} opacity={0.35} />
                              </div>
                              {item.cover_url ? (
                                <img 
                                  src={resolveMediaUrl(item.cover_url)} 
                                  alt="" 
                                  loading="lazy" 
                                  decoding="async" 
                                  style={{ position: 'relative', zIndex: 1 }}
                                  onError={(e) => {
                                    (e.currentTarget as HTMLElement).style.display = 'none';
                                  }}
                                />
                              ) : null}
                              <div className="ep-status-overlay">
                                <span className="ep-sub" style={{ background: 'rgba(0,0,0,0.7)', padding: '2px 6px', borderRadius: '4px' }}>
                                  <Type size={10} style={{marginRight: '2px'}}/>{item.episodes_watched} / {item.total_episodes || '?'}
                                </span>
                                {item.taste_match_pct !== undefined && item.taste_match_pct > 0 && (
                                  <span className={`taste-badge ${getTasteBadgeTierClass(item.taste_match_pct)}`} style={{ marginLeft: '4px' }}>
                                    <Sparkles size={9} /> {item.taste_match_pct}%
                                  </span>
                                )}
                              </div>
                              <button
                                className={`library-fav-btn ${item.is_favorite ? 'favorited' : ''}`}
                                style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 12 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleFavorite(item.mal_id, item.is_favorite || 0);
                                }}
                                title={item.is_favorite ? "Remove from favorites" : "Mark as favorite"}
                              >
                                <Star size={13} fill={item.is_favorite ? '#FF2D95' : 'none'} color={item.is_favorite ? '#FF2D95' : 'currentColor'} />
                              </button>
                              {item.status === 'Watching' && (
                                <button 
                                  className="quick-add-btn" 
                                  style={{ zIndex: 10, width: '32px', height: '32px', fontSize: '1rem', borderRadius: '8px 0 0 0' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    quickAddEpisode(item.mal_id, item.episodes_watched || 0, item.total_episodes);
                                  }}
                                  title="Watched another episode"
                                >
                                  +1
                                </button>
                              )}
                              <div className="poster-hover-details">
                                <h4 className="hover-title">{item.title}</h4>
                                <div className="hover-meta">
                                  <span>{item.status}</span>
                                  <span>•</span>
                                  <span>★ {item.score > 0 ? item.score : (item.global_score ? item.global_score.toFixed(1) : '?')}</span>
                                </div>
                                <div 
                                  className="hover-play-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    playEpisode(item.title, item.title_original || null, nextEp, item.mal_id);
                                  }}
                                  title={isCompleted ? `Replay Episode ${nextEp}` : `Play Episode ${nextEp}`}
                                >
                                  <Play size={24} fill="white" color="white" />
                                </div>
                              </div>
                            </div>
                            <div className="card-info">
                              <h3 className="card-title" title={item.title}>{item.title}</h3>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                                <button 
                                  className="library-play-btn"
                                  style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    playEpisode(item.title, item.title_original || null, nextEp, item.mal_id);
                                  }}
                                  title={isCompleted ? `Replay Episode ${nextEp}` : `Play Episode ${nextEp}`}
                                >
                                  <Play size={10} fill="currentColor" /> Ep {nextEp}
                                </button>
                                {item.unwatched_aired_episodes !== undefined && item.unwatched_aired_episodes > 0 && (
                                  <span style={{ fontSize: '0.7rem', color: '#0096C7', fontWeight: 600 }}>
                                    +{item.unwatched_aired_episodes} new
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      }
                    })}
                    {filteredAndSorted.length === 0 && (
                      <div style={{textAlign: 'center', padding: '40px', color: '#8a8d98', gridColumn: '1 / -1'}}>
                        Your watch list is empty. Add anime from the Discover tab!
                      </div>
                    )}
                  </div>
                  {renderPagination()}

                  {/* Multi-Select Floating Batch Action Toolbar */}
                  {isBatchMode && selectedMalIds.length > 0 && (
                    <div className="batch-actions-bar">
                      <span style={{ color: 'white', fontWeight: 600, fontSize: '0.85rem', marginRight: '4px' }}>
                        {selectedMalIds.length} Selected
                      </span>
                      <button className="batch-btn" onClick={() => handleBatchAction('status', 'Watching')}>
                        Watching
                      </button>
                      <button className="batch-btn" onClick={() => handleBatchAction('status', 'Completed')}>
                        Completed
                      </button>
                      <button className="batch-btn" onClick={() => handleBatchAction('status', 'On-Hold')}>
                        On-Hold
                      </button>
                      <button className="batch-btn" onClick={() => handleBatchAction('status', 'Dropped')}>
                        Dropped
                      </button>
                      <button className="batch-btn" onClick={() => handleBatchAction('status', 'Plan to Watch')}>
                        Plan to Watch
                      </button>
                      <button className="batch-btn" onClick={() => handleBatchAction('favorite', 1)} title="Star Selected">
                        <Star size={13} fill="#FF2D95" color="#FF2D95" /> Star
                      </button>
                      <button className="batch-btn danger" onClick={() => {
                        if (confirm(`Delete ${selectedMalIds.length} items from your library?`)) {
                          handleBatchAction('delete', 0);
                        }
                      }}>
                        <Trash2 size={13} /> Delete
                      </button>
                      <button 
                        className="batch-btn" 
                        onClick={() => {
                          if (selectedMalIds.length === filteredAndSorted.length) {
                            setSelectedMalIds([]);
                          } else {
                            setSelectedMalIds(filteredAndSorted.map(i => i.mal_id));
                          }
                        }}
                      >
                        {selectedMalIds.length === filteredAndSorted.length ? 'Clear All' : 'Select All'}
                      </button>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
        
        {/* SEARCH VIEW */}
        {activeTab === 'search' && (
          <div className="search-page">
            <div className="search-bar-container">
              
              {/* Title Search */}
              <div className="anikoto-filter-group">
                <div className="anikoto-filter-header">
                  <Type size={20} />
                  <span>Title</span>
                </div>
                <div className="search-input-group">
                  <Search className="search-icon" size={20} />
                  <input 
                    type="text" 
                    className="search-main-input" 
                    placeholder="Search anime..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <div className="search-filters-row">
                {/* Genres */}
                <div className="anikoto-filter-group" style={{flex: 1, minWidth: '160px'}}>
                  <div className="anikoto-filter-header">
                    <Hash size={20} />
                    <span>Genres</span>
                  </div>
                  <select 
                    className="anikoto-select" 
                    onChange={e => {
                      if (e.target.value && !searchGenres.includes(e.target.value)) {
                        setSearchGenres([...searchGenres, e.target.value])
                      }
                      e.target.value = ""
                    }}
                  >
                    <option value="">Any</option>
                    {['Action','Adventure','Comedy','Drama','Fantasy','Romance','Sci-Fi','Slice of Life','Thriller','Mystery','Mecha','Sports','Music'].map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>

                {/* Season & Year */}
                <div className="anikoto-filter-group" style={{flex: 1.5, minWidth: '220px'}}>
                  <div className="anikoto-filter-header">
                    <CalendarRange size={20} />
                    <span>Season</span>
                  </div>
                  <div style={{display: 'flex'}}>
                    <select className="anikoto-select" style={{borderTopRightRadius: 0, borderBottomRightRadius: 0, borderRight: 'none'}} value={searchSeason} onChange={e => setSearchSeason(e.target.value)}>
                      <option value="">Any</option>
                      <option value="WINTER">Winter</option>
                      <option value="SPRING">Spring</option>
                      <option value="SUMMER">Summer</option>
                      <option value="FALL">Fall</option>
                    </select>
                    <select className="anikoto-select" style={{borderTopLeftRadius: 0, borderBottomLeftRadius: 0}} value={searchYear} onChange={e => setSearchYear(e.target.value)}>
                      <option value="">Any</option>
                      {Array.from({length: 40}, (_, i) => 2026 - i).map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Format */}
                <div className="anikoto-filter-group" style={{flex: 1, minWidth: '140px'}}>
                  <div className="anikoto-filter-header">
                    <Tv size={20} />
                    <span>Format</span>
                  </div>
                  <select className="anikoto-select" value={searchFormat} onChange={e => setSearchFormat(e.target.value)}>
                    <option value="">Any</option>
                    <option value="TV">TV Show</option>
                    <option value="MOVIE">Movie</option>
                    <option value="OVA">OVA</option>
                  </select>
                </div>

                {/* Status */}
                <div className="anikoto-filter-group" style={{flex: 1, minWidth: '140px'}}>
                  <div className="anikoto-filter-header">
                    <MonitorPlay size={20} />
                    <span>Status</span>
                  </div>
                  <select className="anikoto-select" value={searchStatus} onChange={e => setSearchStatus(e.target.value)}>
                    <option value="">Any</option>
                    <option value="Currently Airing">Releasing</option>
                    <option value="Finished Airing">Finished</option>
                    <option value="Not yet aired">Not Yet Released</option>
                  </select>
                </div>

                {/* Sort */}
                <div className="anikoto-filter-group" style={{flex: 1, minWidth: '140px'}}>
                  <div className="anikoto-filter-header">
                    <ArrowDownWideNarrow size={20} />
                    <span>Sort</span>
                  </div>
                  <select className="anikoto-select" value={searchSort} onChange={e => setSearchSort(e.target.value)}>
                    <option value="trending">Trending</option>
                    <option value="popularity">Popularity</option>
                    <option value="score">Score</option>
                    <option value="title">Title</option>
                    <option value="date">Release Date</option>
                  </select>
                </div>
                
                {/* Reset Filters Icon */}
                <div className="anikoto-filter-group" style={{flex: '0 0 auto', justifyContent: 'flex-end'}}>
                  <button 
                    className={`reset-filters-btn ${(searchGenres.length > 0 || searchSeason || searchYear || searchFormat || searchStatus || searchQuery) ? 'active' : ''}`}
                    onClick={() => {
                      setSearchQuery('')
                      setSearchGenres([])
                      setSearchSeason('')
                      setSearchYear('')
                      setSearchFormat('')
                      setSearchStatus('')
                    }}
                    title="Reset Filters"
                  >
                    {(searchGenres.length > 0 || searchSeason || searchYear || searchFormat || searchStatus || searchQuery) ? <FilterX size={24}/> : <Filter size={24}/>}
                  </button>
                </div>
              </div>

              {/* Active Badges */}
              {(searchGenres.length > 0 || searchSeason || searchYear || searchFormat || searchStatus) && (
                <div className="active-badges-container">
                  {searchGenres.map(g => (
                    <div key={g} className="filter-badge">
                      <span>{g}</span>
                      <button onClick={() => removeSearchFilter('genre', g)}><X size={14}/></button>
                    </div>
                  ))}
                  {searchSeason && (
                    <div className="filter-badge">
                      <span>{searchSeason.toLowerCase()}</span>
                      <button onClick={() => removeSearchFilter('season')}><X size={14}/></button>
                    </div>
                  )}
                  {searchYear && (
                    <div className="filter-badge">
                      <span>{searchYear}</span>
                      <button onClick={() => removeSearchFilter('year')}><X size={14}/></button>
                    </div>
                  )}
                  {searchFormat && (
                    <div className="filter-badge">
                      <span>{searchFormat}</span>
                      <button onClick={() => removeSearchFilter('format')}><X size={14}/></button>
                    </div>
                  )}
                  {searchStatus && (
                    <div className="filter-badge">
                      <span>{searchStatus}</span>
                      <button onClick={() => removeSearchFilter('status')}><X size={14}/></button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Results Grid */}
            <div className="search-results-container">
              {searchResults.length > 0 ? (
                <>
                  <div className="carousel-container" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '24px', flexWrap: 'wrap'}}>
                    {searchResults.map((anime, idx) => (
                      <div key={idx} className="anime-card" onClick={() => setSelectedAnime(anime)} style={{minWidth: 'unset', width: '100%'}}>
                        {anime.cover_url ? (
                          <img src={resolveMediaUrl(anime.cover_url)} alt={anime.title} className="anime-cover" />
                        ) : (
                          <div className="anime-cover" style={{ backgroundColor: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                            <ImageIcon size={48} opacity={0.3} />
                          </div>
                        )}
                        <div className="poster-hover-details">
                          <h4 className="hover-title">{anime.title}</h4>
                          <div className="hover-meta">
                            <span>{anime.year || '?'}</span>
                            <span>•</span>
                            <span>{anime.episodes === 1 ? 'Movie' : (anime.episodes ? `${anime.episodes} EPS` : '? EPS')}</span>
                          </div>
                          {anime.score && (
                            <div style={{fontSize: '0.85rem', color: '#FF2D95', marginBottom: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px'}}>
                              <Star size={12} fill="currentColor" /> {anime.score.toFixed(1)} Score
                            </div>
                          )}
                          <div className="hover-play-btn">
                            <Play size={24} fill="white" color="white" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {hasMoreSearch && (
                    <button 
                      className="load-more-btn"
                      onClick={() => executeSearch(searchPage + 1)}
                      disabled={searchLoading}
                    >
                      {searchLoading ? 'Loading...' : 'Load More'}
                    </button>
                  )}
                </>
              ) : (
                <div style={{textAlign: 'center', padding: '60px', color: 'var(--text-secondary)'}}>
                  {searchLoading ? 'Searching...' : 'No results found.'}
                </div>
              )}
            </div>
          </div>
        )}
        
        {activeTab !== 'home' && activeTab !== 'discover' && activeTab !== 'library' && activeTab !== 'search' && (
          <div className="page-header">
            <h1 className="page-title" style={{textTransform: 'capitalize'}}>{activeTab}</h1>
            <p className="page-subtitle">This page is a mockup for the KyōRenzu-style library interface.</p>
          </div>
        )}

        {/* DETAILS MODAL */}
        {selectedAnime && (
          <div className="modal-backdrop" onClick={() => setSelectedAnime(null)}>
            {/* Atmospheric Dynamic Ambilight Cover Glow */}
            <div 
              className="modal-ambient-glow"
              style={{
                backgroundImage: `url(${resolveMediaUrl(selectedAnime.cover_url) || './no_image_cover.jpg'})`
              }}
            />
            <div className="anikoto-details-modal" onClick={e => e.stopPropagation()}>
              <div 
                className="anikoto-modal-banner" 
                style={{ backgroundImage: `url(${resolveMediaUrl(selectedAnime.cover_url) || './no_image_cover.jpg'})` }}
              >
                <div className="anikoto-banner-overlay"></div>
                <button className="anikoto-modal-close" onClick={() => setSelectedAnime(null)}>
                  <X size={20} />
                </button>
              </div>
              
              <div className="anikoto-modal-content">
                {/* Left: Cover */}
                <div className="anikoto-modal-left">
                  <img src={resolveMediaUrl(selectedAnime.cover_url) || './no_image_cover.jpg'} alt={selectedAnime.title} className="anikoto-modal-cover-img" />
                </div>
                
                {/* Center: Info */}
                <div className="anikoto-modal-center">
                  <h1 className="anikoto-modal-title">{selectedAnime.title}</h1>
                  
                  <div className="anikoto-modal-stats">
                    {selectedAnime.score && (
                      <span className="stat-item"><Star size={16} className="text-accent" /> Rating: {Math.round(selectedAnime.score * 10)}%</span>
                    )}
                    <span className="stat-item"><Tv size={16} /> Format: {selectedAnime.type || ((selectedAnime.episodes || selectedAnime.total_episodes) === 1 ? 'Movie' : 'TV Series')}</span>
                    <span className="stat-item"><Play size={16} /> Episodes: {dynamicEpisodes || selectedAnime.episodes || selectedAnime.total_episodes || '?'}</span>
                    {selectedAnime.year && (
                      <span className="stat-item"><CalendarRange size={16} /> Released: {selectedAnime.year}</span>
                    )}
                    {selectedAnime.members && (
                      <span className="stat-item">Reviews: {selectedAnime.members?.toLocaleString() || "N/A"}</span>
                    )}
                  </div>
                  
                  <div className="anikoto-modal-actions">
                    <button className="anikoto-btn-play" onClick={() => playEpisode(selectedAnime.title, selectedAnime.title_original, 1)}>
                      <Play size={18} fill="currentColor" /> Watch Now
                    </button>
                    {!userLibrary.find(item => item.mal_id === selectedAnime.mal_id) && (
                      <button className="anikoto-btn-secondary" onClick={() => addToLibrary(selectedAnime)}>
                        <Library size={18} /> Add to Library
                      </button>
                    )}
                    <button className="anikoto-btn-secondary" onClick={() => playVideo(selectedAnime.title, selectedAnime.theme_url)}>
                      <Play size={18} /> Trailer
                    </button>
                  </div>
                  
                  {userLibrary.find(item => item.mal_id === selectedAnime.mal_id) && (() => {
                    const libItem = userLibrary.find(item => item.mal_id === selectedAnime.mal_id) || selectedAnime;
                    return (
                      <div style={{ marginTop: '16px', background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div className="library-management-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-primary)', fontSize: '0.9rem', fontWeight: 'bold' }}>
                            <Library size={16} /> In Your Library
                            {libItem.taste_match_pct !== undefined && libItem.taste_match_pct > 0 && (
                              <span className={`taste-badge ${getTasteBadgeTierClass(libItem.taste_match_pct)}`} style={{ marginLeft: '4px' }}>
                                <Sparkles size={11} /> {libItem.taste_match_pct}% Match
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <button
                              onClick={() => toggleFavorite(libItem.mal_id, libItem.is_favorite || 0)}
                              style={{ 
                                padding: '4px 8px', 
                                fontSize: '0.75rem', 
                                background: libItem.is_favorite ? 'rgba(255, 45, 149, 0.22)' : 'rgba(255, 255, 255, 0.05)', 
                                color: libItem.is_favorite ? '#FF2D95' : 'var(--text-secondary)', 
                                border: '1px solid ' + (libItem.is_favorite ? '#FF2D95' : 'var(--border-color)'), 
                                borderRadius: '4px', 
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <Star size={12} fill={libItem.is_favorite ? '#FF2D95' : 'none'} color={libItem.is_favorite ? '#FF2D95' : 'currentColor'} />
                              {libItem.is_favorite ? 'Favorited' : 'Favorite'}
                            </button>
                            <button 
                              onClick={() => deleteLibraryItem(libItem.mal_id)}
                              style={{ padding: '4px 8px', fontSize: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '4px', cursor: 'pointer', transition: 'all 0.2s' }}
                              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
                              onMouseOut={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', width: '100%' }}>
                          <div style={{ flex: 1, minWidth: '100px' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Status</label>
                            <select 
                              className="input-field" 
                              style={{ padding: '6px 12px', width: '100%' }}
                              value={libItem.status || 'Watching'}
                              onChange={(e) => updateLibraryItem(libItem.mal_id, { status: e.target.value })}
                            >
                              <option value="Watching">Watching</option>
                              <option value="Completed">Completed</option>
                              <option value="On-Hold">On-Hold</option>
                              <option value="Dropped">Dropped</option>
                              <option value="Plan to Watch">Plan to Watch</option>
                            </select>
                          </div>
                          <div style={{ flex: 1, minWidth: '100px' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Episodes</label>
                            <input 
                              type="number"
                              min="0"
                              max={selectedAnime.total_episodes || 9999}
                              className="input-field" 
                              style={{ padding: '6px 12px', width: '100%' }}
                              value={libItem.episodes_watched || 0}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                const maxEps = selectedAnime.total_episodes || selectedAnime.episodes;
                                const clampedVal = (maxEps && maxEps > 0) ? Math.min(val, maxEps) : val;
                                updateLibraryItem(libItem.mal_id, { episodes_watched: clampedVal });
                              }}
                            />
                          </div>
                          <div style={{ flex: 1, minWidth: '150px' }}>
                            <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                              <span>Score</span>
                              <span style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>{libItem.score > 0 ? libItem.score : 'Unrated'}</span>
                            </label>
                            <input 
                              type="range"
                              min="0"
                              max="10"
                              step="0.5"
                              style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--accent-primary)' }}
                              value={libItem.score || 0}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setUserLibrary(prev => prev.map(i => i.mal_id === libItem.mal_id ? { ...i, score: val } : i));
                              }}
                              onMouseUp={(e) => updateLibraryItem(libItem.mal_id, { score: parseFloat(e.currentTarget.value) || 0 })}
                              onTouchEnd={(e) => updateLibraryItem(libItem.mal_id, { score: parseFloat(e.currentTarget.value) || 0 })}
                            />
                          </div>
                          
                          <div style={{ flex: '1 1 100%', minWidth: '100%', marginTop: '8px' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Personal Notes / Review</label>
                            <textarea 
                              className="input-field" 
                              style={{ width: '100%', minHeight: '60px', padding: '8px 12px', resize: 'vertical' }}
                              placeholder="Write your review or notes here..."
                              value={libItem.notes || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setUserLibrary(prev => prev.map(i => i.mal_id === libItem.mal_id ? { ...i, notes: val } : i));
                              }}
                              onBlur={(e) => updateLibraryItem(libItem.mal_id, { notes: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })()}

                  <div className="anikoto-modal-meta-row">
                    {selectedAnime.season && selectedAnime.year && (
                      <span><CalendarRange size={14}/> {selectedAnime.season} {selectedAnime.year}</span>
                    )}
                    {selectedAnime.status && <span><MonitorPlay size={14}/> {selectedAnime.status}</span>}
                    {selectedAnime.studio && <span><Building2 size={14}/> {selectedAnime.studio}</span>}
                    <span><Globe size={14}/> Japan</span>
                    {selectedAnime.title_english && (
                      <span><Type size={14}/> {selectedAnime.title_english}</span>
                    )}
                    {selectedAnime.title_japanese && (
                      <span><Type size={14}/> {selectedAnime.title_japanese}</span>
                    )}
                  </div>
                  
                  {selectedAnime.genres && (
                    <div className="anikoto-modal-genres">
                      {selectedAnime.genres.split(',').map((g: string, i: number) => (
                        <span key={i} className="anikoto-genre-pill"><Hash size={14}/> {g.trim()}</span>
                      ))}
                    </div>
                  )}
                  
                  <div className="anikoto-modal-synopsis-section">
                    <div className="synopsis-divider">
                      <span>Synopsis</span>
                    </div>
                    <p className="synopsis-text">{cleanSynopsis(selectedAnime.synopsis)}</p>
                  </div>
                  
                  {/* Recommendations Section */}
                  <div className="anikoto-modal-recommendations-section">
                    <div className="synopsis-divider">
                      <span>Recommendations</span>
                    </div>
                    {modalRecommendations.length === 0 ? (
                      <div className="recs-loading">Finding similar anime...</div>
                    ) : (
                      <div className="anikoto-recs-grid">
                        {modalRecommendations.map((rec, i) => (
                          <div key={i} className="anikoto-rec-card" onClick={() => setSelectedAnime(rec)}>
                            <img src={resolveMediaUrl(rec.cover_url) || './no_image_cover.jpg'} alt={rec.title} />
                            <div className="rec-info">
                              <span className="rec-title">{rec.title}</span>
                              <span className="rec-meta">{rec.year || '?'} • {rec.episodes === 1 ? 'Movie' : (rec.episodes ? `${rec.episodes} Ep` : '? Ep')}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Right: Episodes List */}
                <div className="anikoto-modal-right">
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
                    <h3 style={{color: 'white', fontSize: '1.2rem', margin: 0}}>Episodes</h3>
                    <div style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
                      <select 
                        value={quality}
                        onChange={(e) => setQuality(e.target.value)}
                        style={{
                          background: 'rgba(255,255,255,0.1)',
                          border: 'none',
                          color: 'white',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '0.85rem',
                          outline: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="best">Best Quality</option>
                        <option value="1080p">1080p</option>
                        <option value="720p">720p</option>
                        <option value="480p">480p</option>
                        <option value="360p">360p</option>
                      </select>
                      
                      <div style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer'}} onClick={() => setIsDub(!isDub)}>
                        <div style={{width: '36px', height: '18px', borderRadius: '10px', background: isDub ? 'var(--primary)' : 'rgba(255,255,255,0.2)', position: 'relative', transition: '0.3s'}}>
                          <div style={{width: '14px', height: '14px', borderRadius: '50%', background: 'white', position: 'absolute', top: '2px', left: isDub ? '20px' : '2px', transition: '0.3s'}}></div>
                        </div>
                        <span style={{fontSize: '0.85rem', color: isDub ? 'white' : 'var(--text-secondary)'}}>Watch Dub</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="episodes-list" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ padding: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <select 
                        className="input-field"
                        style={{ padding: '6px 12px', minWidth: '120px' }}
                        value={episodePage}
                        onChange={(e) => setEpisodePage(Number(e.target.value))}
                      >
                        {Array.from({ length: Math.ceil((dynamicEpisodes || selectedAnime.episodes || 12) / 100) }).map((_, i) => (
                          <option key={i} value={i}>
                            {i * 100 + 1}-{Math.min((i + 1) * 100, dynamicEpisodes || selectedAnime.episodes || 12)}
                          </option>
                        ))}
                      </select>
                      
                      <input 
                        type="number" 
                        id="jump-episode-input"
                        placeholder="Find num..." 
                        className="input-field" 
                        style={{ flex: 1, padding: '6px 12px' }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const rawEp = parseInt((e.target as HTMLInputElement).value);
                            const maxVal = selectedAnime.total_episodes || selectedAnime.episodes;
                            const ep = (maxVal && maxVal > 0) ? Math.min(rawEp, maxVal) : rawEp;
                            if (ep > 0) playEpisode(selectedAnime.title, selectedAnime.title_original, ep, selectedAnime.mal_id);
                          }
                        }}
                      />
                      <button 
                        className="anikoto-btn-primary" 
                        style={{ padding: '6px 12px' }}
                        onClick={() => {
                          const input = document.getElementById('jump-episode-input') as HTMLInputElement;
                          const rawEp = parseInt(input.value);
                          const maxVal = selectedAnime.total_episodes || selectedAnime.episodes;
                          const ep = (maxVal && maxVal > 0) ? Math.min(rawEp, maxVal) : rawEp;
                          if (ep > 0) playEpisode(selectedAnime.title, selectedAnime.title_original, ep, selectedAnime.mal_id);
                        }}
                      >
                        Play
                      </button>
                    </div>

                    <div className="episodes-grid">
                      {selectedAnime.episodes === 1 ? (
                        <button className="episode-grid-btn" onClick={() => playEpisode(selectedAnime.title, selectedAnime.title_original, 1)}>
                          1 (Movie)
                        </button>
                      ) : (
                        Array.from({ length: Math.min(100, (dynamicEpisodes || selectedAnime.episodes || 12) - episodePage * 100) }).map((_, i) => {
                          const epNum = episodePage * 100 + i + 1;
                          return (
                            <button key={epNum} className="episode-grid-btn" onClick={() => playEpisode(selectedAnime.title, selectedAnime.title_original, epNum)}>
                              {epNum}
                            </button>
                          );
                        })
                      )}
                    </div>

                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
      </main>

      {/* Unique Anime Pop Up */}
      {showUniqueModal && (
        <div className="modal-overlay" onClick={() => setShowUniqueModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center', padding: '32px', aspectRatio: 'auto', overflow: 'visible' }}>
            <div style={{ marginBottom: '16px', color: 'var(--accent-primary)', display: 'flex', justifyContent: 'center' }}>
              <MonitorPlay size={48} />
            </div>
            <h2 style={{ marginBottom: '12px', fontSize: '1.5rem', color: 'white' }}>Unique Watch Stats</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: '1.5' }}>
              You have completed exactly <strong style={{ color: 'white', fontSize: '1.2rem' }}>{uniqueCount}</strong> unique TV series, carefully excluding all sequels and spin-offs!
            </p>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: '1.5' }}>
              You have also watched <strong style={{ color: 'white', fontSize: '1.2rem' }}>{moviesCount}</strong> total movies.
            </p>
            <button className="btn-primary" onClick={() => setShowUniqueModal(false)} style={{ width: '100%', justifyContent: 'center' }}>
              Awesome!
            </button>
          </div>
        </div>
      )}

      {/* Video Player Modal */}
      {videoUrl && (
        <div className="modal-overlay" onClick={() => setVideoUrl(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setVideoUrl(null)}>
              <X size={24} />
            </button>
            <video src={videoUrl} autoPlay controls></video>
          </div>
        </div>
      )}
      {/* Launching Player Toast */}
      {errorMessage && (
        <div onClick={() => setErrorMessage(null)} style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--surface)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '16px',
            maxWidth: '450px', 
            width: '100%',
            textAlign: 'center', 
            padding: '32px 24px',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
          }}>
            <div style={{width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto'}}>
              <AlertCircle size={32} />
            </div>
            <h2 style={{fontSize: '1.5rem', fontWeight: '700', marginBottom: '12px', color: '#f8fafc'}}>Playback Error</h2>
            <p style={{fontSize: '1.05rem', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '28px'}}>
              {cleanErrorMessage(errorMessage)}
            </p>
            <button 
              className="btn-primary" 
              style={{width: '100%', padding: '14px', borderRadius: '12px', fontSize: '1.05rem', fontWeight: '600'}}
              onClick={() => setErrorMessage(null)}
            >
              Okay, got it
            </button>
          </div>
        </div>
      )}

      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          padding: '16px 24px',
          borderRadius: '8px',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          zIndex: 9999,
          animation: 'slideUp 0.3s ease-out forwards'
        }}>
          <MonitorPlay size={20} color="var(--primary)" />
          {toastMessage}
        </div>
      )}

      {renderStatsModal()}
      {renderThemeModal()}
      {renderSavePresetModal()}

      {!userName && systemStatus?.state === 'ready' && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '400px', height: 'auto', aspectRatio: 'auto', overflow: 'visible', textAlign: 'center', padding: '32px', background: 'var(--bg-dark)' }}>
            <h2 style={{ marginBottom: '12px' }}>Welcome to KyoRenzu!</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Please enter your username to personalize your profile.</p>
            <form onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const name = fd.get('username') as string;
              if (name && name.trim()) {
                setUserName(name.trim());
                localStorage.setItem('kyorenzu_username', name.trim());
              } else {
                setUserName('Guest');
                localStorage.setItem('kyorenzu_username', 'Guest');
              }
            }}>
              <input 
                name="username"
                autoFocus
                placeholder="e.g. AnimeFan99"
                style={{ width: '100%', padding: '12px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white', marginBottom: '16px' }}
              />
              <button type="submit" className="btn-primary" style={{ width: '100%', padding: '12px' }}>Continue</button>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}

export default App
