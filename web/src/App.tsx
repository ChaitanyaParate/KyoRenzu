import { useState, useEffect, useRef } from 'react'
import { Sparkles, Music, BookOpen, Star, Search, Image as ImageIcon, Home, Library, Bell, Menu, Play, Info, X, Type, Hash, CalendarRange, Tv, MonitorPlay, ArrowDownWideNarrow, Filter, FilterX, Building2, Globe, Download, Upload, Shuffle, Users, User, Compass, AlertCircle, LayoutGrid, List, BarChart2, RefreshCw, CheckSquare, Square, Trash2, Check } from 'lucide-react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import './index.css'

export const THEMES = [
  { id: 'crimson', name: 'Cerulean & Neon Rose', primary: '#00A3FF', secondary: '#FF2A85', bg: '#07080B' },
] as const;
export type ThemeId = typeof THEMES[number]['id'];

export const THEME_CHART_COLORS: Record<string, string[]> = {
  crimson: ['#00A3FF', '#38BDF8', '#FF2A85', '#0284C7', '#7DD3FC', '#FF66AA', '#0369A1', '#D60058'],
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
  rank?: number
  title: string
  title_original: string
  score: number | null
  members?: number
  genres: string | null
  synopsis?: string | null
  year?: number | null
  episodes?: number | null
  similarity?: number
  plot_similarity?: number | null
  audio_similarity?: number | null
  cover_url: string | null
  theme_url?: string | null
}

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

  // Theme State & Persistence (Locked to 3-Color Palette)
  const [theme] = useState<ThemeId>('crimson');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('kyorenzu_theme', theme);
  }, [theme]);

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
    if (activeTab === 'library' && userLibrary.length === 0) {
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
  const [animeInput, setAnimeInput] = useState('')
  const [preference, setPreference] = useState('')
  const [plotPreference, setPlotPreference] = useState('')
  const [audioPreference, setAudioPreference] = useState('')
  const [preferredYear, setPreferredYear] = useState<string>('')
  const [numRecommendations, setNumRecommendations] = useState(12)
  const [topN] = useState(12)
  const [discoverLoading, setDiscoverLoading] = useState(false)
  const [results, setResults] = useState<AnimeRecommendation[]>([])
  const [error, setError] = useState<string | null>(null)
  const [systemStatus, setSystemStatus] = useState<{state: string, progress: number, message: string} | null>(null);
  
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
  
  const handleDiscoverSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!useLibraryAsRef && !animeInput.trim()) {
      setError("Please enter some anime titles you like, or select 'Use My Library'.")
      return
    }
    
    setDiscoverLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`${API_BASE}/api/recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anime_input: animeInput,
          preference: preference,
          plot_preference: plotPreference,
          audio_preference: audioPreference,
          preferred_year: preferredYear ? parseInt(preferredYear, 10) : null,
          top_n: numRecommendations,
          use_library: useLibraryAsRef
        })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.detail || 'An error occurred')
      }
      
      if (data.status === 'success') {
        setResults(data.results)
      } else {
        setError(data.message)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setDiscoverLoading(false)
    }
  }

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

  const addToLibrary = async (anime: any) => {
    try {
      const response = await fetch(`${API_BASE}/api/user_library`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mal_id: anime.mal_id })
      })
      if (response.ok) {
        fetchUserLibrary()
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

    const activeThemeChartColors = THEME_CHART_COLORS[theme] || THEME_CHART_COLORS.crimson;

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
                  background: 'linear-gradient(135deg, #00A3FF 0%, #FF2A85 100%)',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 0 14px rgba(0, 163, 255, 0.45), 0 0 6px rgba(255, 42, 133, 0.35)',
                }}
              >
                <div style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  background: '#07080B',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="9" stroke="url(#brand_logo_grad)" strokeWidth="2" strokeDasharray="13 4" />
                    <circle cx="12" cy="12" r="4" fill="url(#brand_logo_grad)" />
                    <defs>
                      <linearGradient id="brand_logo_grad" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#00A3FF" />
                        <stop offset="1" stopColor="#FF2A85" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '2px', letterSpacing: '-0.3px', userSelect: 'none' }}>
                <span style={{ color: '#FFFFFF', fontWeight: 900, fontSize: '1.45rem', fontFamily: "'Nunito', sans-serif" }}>Kyō</span>
                <span style={{ color: '#00A3FF', fontWeight: 900, fontSize: '1.45rem', fontFamily: "'Nunito', sans-serif" }}>Renzu</span>
                <span style={{ 
                  display: 'inline-block',
                  width: '6px', 
                  height: '6px', 
                  minWidth: '6px',
                  minHeight: '6px',
                  borderRadius: '50%', 
                  background: '#FF2A85', 
                  marginLeft: '3px',
                  marginBottom: '2px',
                  boxShadow: '0 0 8px #FF2A85',
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
            <div className="page-header">
              <h1 className="page-title">Discover</h1>
              <p className="page-subtitle">Find new anime based on visual aesthetics, semantics, and audio.</p>
            </div>

            <form onSubmit={handleDiscoverSubmit} className="search-form">
              <div className="form-group full" style={{ marginBottom: '16px' }}>
                <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Star size={14} /> Your Reference Library
                  
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Use My Library</span>
                    <div 
                      className={`toggle-switch ${useLibraryAsRef ? 'on' : 'off'}`} 
                      onClick={() => setUseLibraryAsRef(!useLibraryAsRef)}
                      style={{
                        width: '40px', height: '20px', borderRadius: '10px', 
                        background: useLibraryAsRef ? 'var(--accent-primary)' : 'rgba(255,255,255,0.2)',
                        position: 'relative', cursor: 'pointer', transition: '0.3s'
                      }}
                    >
                      <div style={{
                        width: '16px', height: '16px', borderRadius: '50%', background: 'white',
                        position: 'absolute', top: '2px', left: useLibraryAsRef ? '22px' : '2px', transition: '0.3s'
                      }} />
                    </div>
                  </div>
                </label>
                
                {!useLibraryAsRef ? (
                  <input 
                    type="text"
                    className="input-field" 
                    placeholder="e.g. Death Note, Attack on Titan"
                    value={animeInput}
                    onChange={(e) => setAnimeInput(e.target.value)}
                  />
                ) : (
                  <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    Using your KyōRenzu library to generate recommendations. 
                    Titles with high "Personal Score" will be weighted more heavily!
                  </div>
                )}
              </div>
              
              <div className="form-group">
                <label className="input-label"><ImageIcon size={14} /> Visual Vibe</label>
                <input 
                  type="text"
                  className="input-field" 
                  placeholder="Dark neo-noir thriller"
                  value={preference}
                  onChange={(e) => setPreference(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="input-label"><BookOpen size={14} /> Plot Summary</label>
                <input 
                  type="text"
                  className="input-field" 
                  placeholder="Space bounty hunters"
                  value={plotPreference}
                  onChange={(e) => setPlotPreference(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="input-label"><Music size={14} /> OP/ED Audio</label>
                <input 
                  type="text"
                  className="input-field" 
                  placeholder="Smooth jazz saxophone"
                  value={audioPreference}
                  onChange={(e) => setAudioPreference(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="input-label"><CalendarRange size={14} /> Preferred Year</label>
                <input 
                  type="number"
                  className="input-field"
                  placeholder="e.g. 1998, 2026..."
                  value={preferredYear}
                  onChange={(e) => setPreferredYear(e.target.value)}
                  min="1960"
                  max="2030"
                />
              </div>

              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <label className="input-label"><Filter size={14} /> Amount</label>
                <input 
                  type="number"
                  className="input-field"
                  value={numRecommendations}
                  onChange={(e) => setNumRecommendations(Number(e.target.value) || 1)}
                  min="1"
                  max="100"
                />
              </div>
              
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <button type="submit" className="btn-primary" disabled={discoverLoading}>
                  <Search size={18} />
                  {discoverLoading ? 'Searching...' : 'Search Library'}
                </button>
              </div>

              {error && <div className="form-group full" style={{ color: '#ef4444' }}>{error}</div>}
            </form>

            <div className="results-section">
              {results.length > 0 && (
                <h2 className="section-title"><Sparkles size={20} color="var(--accent-primary)"/> Recommended for You</h2>
              )}
              
              {discoverLoading ? (
                <div className="loader-container">
                  <div className="spinner"></div>
                </div>
              ) : results.length > 0 ? (
                <div className="anime-grid">
                  {results.map((anime, idx) => (
                    <div key={idx} className="anikoto-card" onClick={() => setSelectedAnime(anime)}>
                      <div className="poster-container">
                        <div className="rank-badge" style={{ position: 'absolute', top: 0, left: 0, background: 'var(--accent-primary)', color: '#ffffff', fontWeight: 'bold', padding: '4px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, borderBottomRightRadius: '8px', fontSize: '0.9rem' }}>#{anime.rank}</div>
                        
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
                          {anime.similarity !== undefined && anime.similarity !== null && (
                            <div style={{fontSize: '0.85rem', color: 'var(--accent-primary)', marginBottom: '16px', fontWeight: 700}}>
                              {Math.round(anime.similarity * 100)}% Visual Match
                            </div>
                          )}
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
