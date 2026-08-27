import { useState, useEffect, useRef } from 'react'
import { Sparkles, Music, BookOpen, Star, Search, Image as ImageIcon, Home, Library, Settings, Bell, Menu, Play, Info, X, Type, Hash, CalendarRange, Tv, MonitorPlay, ArrowDownWideNarrow, Filter, FilterX, Building2, Globe, Download, Upload } from 'lucide-react'
import './index.css'

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

function App() {
  const [activeTab, setActiveTab] = useState('home')
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false)
  const [episodePage, setEpisodePage] = useState(0)
  
  // Library State
  const [libraryLoading, setLibraryLoading] = useState(true)
  const [heroAnimes, setHeroAnimes] = useState<AnimeRecommendation[]>([])
  const [currentHeroIndex, setCurrentHeroIndex] = useState(0)
  const [categories, setCategories] = useState<CategoryRow[]>([])
  
  // Details Modal State
  const [selectedAnime, setSelectedAnime] = useState<any | null>(null)
  const [modalRecommendations, setModalRecommendations] = useState<any[]>([])
  
  // Video Player State
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [isDub, setIsDub] = useState(false)
  const [quality, setQuality] = useState('best')
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // User Library State
  const [userLibrary, setUserLibrary] = useState<any[]>([])
  const [userLibraryLoading, setUserLibraryLoading] = useState(false)
  const [userLibraryStatusFilter, setUserLibraryStatusFilter] = useState('All')
  const [librarySearch, setLibrarySearch] = useState('')
  const [libraryGenre, setLibraryGenre] = useState('')
  const [librarySeason, setLibrarySeason] = useState('')
  const [libraryYear, setLibraryYear] = useState('')
  const [libraryScore, setLibraryScore] = useState('')
  const [libraryScoreCondition, setLibraryScoreCondition] = useState('>=')

  const [importFile, setImportFile] = useState<File | null>(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [showUniqueModal, setShowUniqueModal] = useState(false)
  const [uniqueCount, setUniqueCount] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const calculateUniqueAnime = () => {
    const bases = new Set();
    userLibrary.filter(item => item.status === 'Completed').forEach(item => {
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
    });
    setUniqueCount(bases.size);
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
      const res = await fetch('http://localhost:8000/api/library/import', {
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
      const response = await fetch('http://localhost:8000/api/user_library')
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

      const res = await fetch(`http://localhost:8000/api/search?${params.toString()}`)
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
  const [topN, setTopN] = useState(12)
  const [discoverLoading, setDiscoverLoading] = useState(false)
  const [results, setResults] = useState<AnimeRecommendation[]>([])
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
    // Fetch Library Data
    const fetchLibrary = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/library')
        const data = await response.json()
        if (data.status === 'success') {
          setHeroAnimes(data.heroAnimes || [])
          setCategories(data.categories || [])
        }
      } catch (err) {
        console.error("Failed to load library:", err)
      } finally {
        setLibraryLoading(false)
      }
    }
    
    fetchLibrary()
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
      console.log("Fetching recommendations for mal_id:", selectedAnime.mal_id);
      setModalRecommendations([]) // clear previous
      fetch(`http://localhost:8000/api/recommendations/${selectedAnime.mal_id}`)
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
      const response = await fetch('http://localhost:8000/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anime_input: animeInput,
          preference: preference,
          plot_preference: plotPreference,
          audio_preference: audioPreference,
          top_n: topN,
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
      window.open('https://www.youtube.com/results?search_query=' + encodeURIComponent(title + ' anime theme'), '_blank')
    }
  }

  const playEpisode = async (title: string, episode: number) => {
    setToastMessage(`Launching mpv for ${title} Episode ${episode}...`);
    try {
      const response = await fetch(`http://localhost:8000/api/play?title=${encodeURIComponent(title)}&episode=${episode}&dub=${isDub}&quality=${quality}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Failed to launch");
      setTimeout(() => setToastMessage(null), 5000);
    } catch (err: any) {
      setToastMessage(`Error launching player: ${err.message}`);
      setTimeout(() => setToastMessage(null), 5000);
    }
  }

  const updateLibraryItem = async (mal_id: number, updates: any) => {
    try {
      const response = await fetch('http://localhost:8000/api/user_library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mal_id, ...updates })
      })
      if (response.ok) {
        fetchUserLibrary()
        if (selectedAnime && selectedAnime.mal_id === mal_id) {
            setSelectedAnime({...selectedAnime, ...updates})
        }
      }
    } catch (err) {
      console.error("Failed to update library item:", err)
    }
  }

  const deleteLibraryItem = async (mal_id: number) => {
    try {
      const response = await fetch(`http://localhost:8000/api/user_library/${mal_id}`, {
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
      const response = await fetch('http://localhost:8000/api/user_library', {
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

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className={`sidebar ${isSidebarExpanded ? 'expanded' : ''}`}>
        <div className="brand" onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}>
          <Menu className="brand-icon" size={24} />
          <span>Anikoto</span>
        </div>
        
        <nav className="nav-menu">
          <div className={`nav-item ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')} title="Home">
            <Home size={24} />
            <span>Home</span>
          </div>
          <div className={`nav-item ${activeTab === 'search' ? 'active' : ''}`} onClick={() => setActiveTab('search')} title="Directory Search">
            <Search size={24} />
            <span>Search</span>
          </div>
          <div className={`nav-item ${activeTab === 'discover' ? 'active' : ''}`} onClick={() => setActiveTab('discover')} title="AI Discover">
            <Sparkles size={24} />
            <span>Discover</span>
          </div>
          <div className={`nav-item ${activeTab === 'library' ? 'active' : ''}`} onClick={() => setActiveTab('library')} title="My Library">
            <Library size={24} />
            <span>Library</span>
          </div>
          <div className={`nav-item ${activeTab === 'notifications' ? 'active' : ''}`} onClick={() => setActiveTab('notifications')} title="Notifications">
            <Bell size={24} />
            <span>Notifications</span>
          </div>
          <div className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')} title="Settings">
            <Settings size={24} />
            <span>Settings</span>
          </div>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="main-content" style={{ padding: activeTab === 'home' ? '0 0 32px 0' : '32px 48px' }}>
        
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
                    {heroAnimes.map((hero: any, idx: number) => (
                      <div key={idx} className={`hero-slide ${idx === currentHeroIndex ? 'active' : ''}`}>
                        {hero.banner_url ? (
                          <img src={hero.banner_url} alt={hero.title} className="hero-banner-image" />
                        ) : (
                          <img src={hero.cover_url || ''} alt={hero.title} className="hero-bg-blur" />
                        )}
                        
                        <div className="hero-overlay">
                          <div className="hero-content">
                            <h1 className="hero-title">{hero.title}</h1>
                            <div className="hero-meta">
                              <span>TV Series</span> • 
                              <span>{hero.episodes || '?'} Episodes</span> • 
                              <span>{hero.year || 'Unknown Year'}</span>
                            </div>
                            <p className="hero-synopsis">{cleanSynopsis(hero.synopsis)}</p>
                            <div className="hero-meta" style={{color: '#fff'}}>
                              {hero.genres?.split(',').slice(0,4).join(' • ')}
                            </div>
                            <div className="hero-actions">
                              <button className="btn-primary" onClick={() => playEpisode(hero.title, 1)}>
                                <Play size={18} fill="currentColor" /> Watch Now
                              </button>
                              <button className="btn-secondary" onClick={() => setSelectedAnime(hero)}>
                                <Info size={18} /> View Details
                              </button>
                            </div>
                          </div>
                          
                          {!hero.banner_url && (
                            <img src={hero.cover_url || ''} alt={hero.title} className="hero-banner-image-contain" />
                          )}
                        </div>
                      </div>
                    ))}
                    <div className="hero-dots">
                      {heroAnimes.map((_, idx) => (
                        <button 
                          key={idx} 
                          className={`hero-dot ${idx === currentHeroIndex ? 'active' : ''}`}
                          onClick={() => setCurrentHeroIndex(idx)}
                        />
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Categories */}
                <div style={{ padding: '0 48px' }}>
                  {categories.map((cat, idx) => (
                    <div key={idx} className="category-row">
                      <h2 className="section-title">{cat.category}</h2>
                      <div className="carousel-container">
                        {cat.anime.map((anime, aIdx) => (
                          <div key={aIdx} className="anime-card" onClick={() => setSelectedAnime(anime)}>
                            {anime.cover_url ? (
                              <img src={anime.cover_url} alt={anime.title} className="anime-cover" />
                            ) : (
                              <div className="anime-cover" style={{ backgroundColor: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                                <ImageIcon size={48} opacity={0.3} />
                              </div>
                            )}

                            <div className="card-overlay">
                              <h3 className="anime-title">{anime.title}</h3>
                              <div style={{ display: 'flex', gap: '6px', fontSize: '0.75rem', color: '#aaa', marginBottom: '4px' }}>
                                <span>{anime.year || '?'}</span>
                                <span>•</span>
                                <span>{anime.episodes === 1 ? 'Movie' : (anime.episodes ? `${anime.episodes} Ep` : '? Ep')}</span>
                              </div>
                              <p className="anime-genres">{anime.genres || "Anime"}</p>
                            </div>
                            
                            <div className="hover-details">
                              <div className="metric-row">
                                <span className="metric-label">Score</span>
                                <span className="metric-value"><Star size={12} fill="currentColor" style={{marginRight:'4px', transform:'translateY(-1px)'}}/>{anime.score?.toFixed(1) || '?'}</span>
                              </div>
                              <div className="metric-row">
                                <span className="metric-label">Year</span>
                                <span className="metric-value">{anime.year || '?'}</span>
                              </div>
                              <div className="metric-row">
                                <span className="metric-label">Episodes</span>
                                <span className="metric-value">{anime.episodes || '?'}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
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
                    Using your Anikoto library to generate recommendations. 
                    Titles with high "Worth Level" will be weighted more heavily!
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
                <div className="gallery-grid">
                  {results.map((anime, idx) => (
                    <div key={idx} className="anime-card" onClick={() => setSelectedAnime(anime)}>
                      <div className="card-badges">
                        <span className="badge rank">#{anime.rank}</span>
                        {anime.score && <span className="badge">★ {anime.score.toFixed(1)}</span>}
                      </div>
                      
                      {anime.cover_url ? (
                        <img src={anime.cover_url} alt={anime.title} className="anime-cover" />
                      ) : (
                        <div className="anime-cover" style={{ backgroundColor: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }} >
                          <ImageIcon size={48} opacity={0.3} />
                        </div>
                      )}

                      <div className="card-overlay">
                        <h3 className="anime-title">{anime.title}</h3>
                        <div style={{ display: 'flex', gap: '6px', fontSize: '0.75rem', color: '#aaa', marginBottom: '4px' }}>
                          <span>{anime.year || '?'}</span>
                          <span>•</span>
                          <span>{anime.episodes === 1 ? 'Movie' : (anime.episodes ? `${anime.episodes} Ep` : '? Ep')}</span>
                        </div>
                        <p className="anime-genres">{anime.genres || "Anime"}</p>
                      </div>

                      <div className="hover-details">
                        <div className="metric-row">
                          <span className="metric-label">Visual Match</span>
                          <span className="metric-value visual">{anime.similarity?.toFixed(2)}</span>
                        </div>
                        {anime.plot_similarity !== null && anime.plot_similarity !== undefined && (
                          <div className="metric-row">
                            <span className="metric-label">Plot Match</span>
                            <span className="metric-value plot">{anime.plot_similarity.toFixed(2)}</span>
                          </div>
                        )}
                        {anime.audio_similarity !== null && anime.audio_similarity !== undefined && (
                          <div className="metric-row">
                            <span className="metric-label">Audio Match</span>
                            <span className="metric-value audio">{anime.audio_similarity.toFixed(2)}</span>
                          </div>
                        )}
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
              <div className="profile-avatar">
                <img src="https://ui-avatars.com/api/?name=Chaitanya004&background=2b2d31&color=fff&size=100" alt="Chaitanya004" />
              </div>
              <div className="profile-info">
                <h1 className="profile-name">Chaitanya004</h1>
                <span className="profile-rank">
                  {userLibrary.filter(item => item.status === 'Completed').length < 10 ? 'Newbie' :
                   userLibrary.filter(item => item.status === 'Completed').length < 50 ? 'Casual Watcher' :
                   userLibrary.filter(item => item.status === 'Completed').length < 150 ? 'Otaku' :
                   userLibrary.filter(item => item.status === 'Completed').length < 300 ? 'Anime Sage' : 'Anime God'}
                </span>
                
                <div className="profile-stats">
                  <div className="stat"><span>Mana</span> <strong>{userLibrary.reduce((acc, item) => acc + (item.episodes_watched || 0), 0)}</strong></div>
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
                <button className="btn-secondary" onClick={() => window.location.href = 'http://localhost:8000/api/library/export?format=csv'}>
                  <Download size={16} style={{marginRight:'6px'}} /> Export CSV
                </button>
                <button className="btn-secondary" onClick={() => window.location.href = 'http://localhost:8000/api/library/export?format=xml'}>
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
                  <p style={{ color: 'var(--text-secondary)' }}>Restore your library from MyAnimeList XML or Anikoto CSV.</p>

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
              <input type="text" placeholder="Search..." className="filter-input" value={librarySearch} onChange={e => setLibrarySearch(e.target.value)} />
              
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
              <button className="filter-btn" onClick={() => {
                setLibrarySearch('');
                setLibraryGenre('');
                setLibrarySeason('');
                setLibraryYear('');
                setLibraryScore('');
                setLibraryScoreCondition('>=');

              }}>Clear Filters</button>
            </div>

            {/* List View */}
            {userLibraryLoading ? (
               <div className="loader-container"><div className="spinner"></div></div>
            ) : (
              <div className="library-list">
                {userLibrary
                  .filter(item => userLibraryStatusFilter === 'All' || item.status === userLibraryStatusFilter)
                  .filter(item => !librarySearch || 
                    (item.title && item.title.toLowerCase().includes(librarySearch.toLowerCase())) ||
                    (item.title_english && item.title_english.toLowerCase().includes(librarySearch.toLowerCase()))
                  )
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
                  .map((item, idx) => (
                  <div key={idx} className="library-list-item" onClick={() => setSelectedAnime(item)}>
                    <img src={item.cover_url} alt={item.title} className="library-item-cover" />
                    <div className="library-item-details">
                      <h3 className="library-item-title">{item.title}</h3>
                      <div className="library-item-meta">
                        <span className={`status-dot ${item.status.toLowerCase().replace(' ', '-')}`}></span>
                        <span>{item.status}</span>
                        <span className="meta-divider">•</span>
                        <span>{item.episodes_watched} / {item.total_episodes || '?'} EPS</span>
                        {item.score > 0 && (
                          <>
                            <span className="meta-divider">•</span>
                            <span style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>★ {item.score}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {userLibrary.length === 0 && (
                  <div style={{textAlign: 'center', padding: '40px', color: '#8a8d98'}}>
                    Your watch list is empty. Add anime from the Discover tab!
                  </div>
                )}
              </div>
            )}
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
                    placeholder="Any" 
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
                          <img src={anime.cover_url} alt={anime.title} className="anime-cover" />
                        ) : (
                          <div className="anime-cover" style={{ backgroundColor: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                            <ImageIcon size={48} opacity={0.3} />
                          </div>
                        )}
                        <div className="card-overlay">
                          <h3 className="anime-title">{anime.title}</h3>
                          <div style={{ display: 'flex', gap: '6px', fontSize: '0.75rem', color: '#aaa', marginBottom: '4px' }}>
                            <span>{anime.year || '?'}</span>
                            <span>•</span>
                            <span>{anime.episodes === 1 ? 'Movie' : (anime.episodes ? `${anime.episodes} Ep` : '? Ep')}</span>
                          </div>
                          <p className="anime-genres">{anime.genres || "Anime"}</p>
                        </div>
                        <div className="hover-details">
                          <div className="metric-row">
                            <span className="metric-label">Score</span>
                            <span className="metric-value"><Star size={12} fill="currentColor" style={{marginRight:'4px', transform:'translateY(-1px)'}}/>{anime.score?.toFixed(1) || '?'}</span>
                          </div>
                          <div className="metric-row">
                            <span className="metric-label">Year</span>
                            <span className="metric-value">{anime.year || '?'}</span>
                          </div>
                          <div className="metric-row">
                            <span className="metric-label">Episodes</span>
                            <span className="metric-value">{anime.episodes || '?'}</span>
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
            <p className="page-subtitle">This page is a mockup for the Anikoto-style library interface.</p>
          </div>
        )}

        {/* DETAILS MODAL */}
        {selectedAnime && (
          <div className="modal-backdrop" onClick={() => setSelectedAnime(null)}>
            <div className="anikoto-details-modal" onClick={e => e.stopPropagation()}>
              <div 
                className="anikoto-modal-banner" 
                style={{ backgroundImage: `url(${selectedAnime.cover_url || './no_image_cover.jpg'})` }}
              >
                <div className="anikoto-banner-overlay"></div>
                <button className="anikoto-modal-close" onClick={() => setSelectedAnime(null)}>
                  <X size={20} />
                </button>
              </div>
              
              <div className="anikoto-modal-content">
                {/* Left: Cover */}
                <div className="anikoto-modal-left">
                  <img src={selectedAnime.cover_url || './no_image_cover.jpg'} alt={selectedAnime.title} className="anikoto-modal-cover-img" />
                </div>
                
                {/* Center: Info */}
                <div className="anikoto-modal-center">
                  <h1 className="anikoto-modal-title">{selectedAnime.title}</h1>
                  
                  <div className="anikoto-modal-stats">
                    {selectedAnime.score && (
                      <span className="stat-item"><Star size={16} className="text-accent" /> Rating: {Math.round(selectedAnime.score * 10)}%</span>
                    )}
                    <span className="stat-item"><Tv size={16} /> Format: {selectedAnime.type || ((selectedAnime.episodes || selectedAnime.total_episodes) === 1 ? 'Movie' : 'TV Series')}</span>
                    <span className="stat-item"><Play size={16} /> Episodes: {selectedAnime.episodes || selectedAnime.total_episodes || '?'}</span>
                    {selectedAnime.members && (
                      <span className="stat-item">Reviews: {selectedAnime.members.toLocaleString()}</span>
                    )}
                  </div>
                  
                  <div className="anikoto-modal-actions">
                    <button className="anikoto-btn-play" onClick={() => playEpisode(selectedAnime.title, 1)}>
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
                          </div>
                          <button 
                            onClick={() => deleteLibraryItem(libItem.mal_id)}
                            style={{ padding: '4px 8px', fontSize: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '4px', cursor: 'pointer', transition: 'all 0.2s' }}
                            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
                            onMouseOut={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                          >
                            Remove
                          </button>
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
                              onChange={(e) => updateLibraryItem(libItem.mal_id, { episodes_watched: parseInt(e.target.value) || 0 })}
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
                              step="1"
                              style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--accent-primary)' }}
                              value={libItem.score || 0}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                setUserLibrary(prev => prev.map(i => i.mal_id === libItem.mal_id ? { ...i, score: val } : i));
                              }}
                              onMouseUp={(e) => updateLibraryItem(libItem.mal_id, { score: parseInt(e.currentTarget.value) || 0 })}
                              onTouchEnd={(e) => updateLibraryItem(libItem.mal_id, { score: parseInt(e.currentTarget.value) || 0 })}
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
                            <img src={rec.cover_url || './no_image_cover.jpg'} alt={rec.title} />
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
                        {Array.from({ length: Math.ceil((selectedAnime.episodes || 1200) / 100) }).map((_, i) => (
                          <option key={i} value={i}>
                            {i * 100 + 1}-{Math.min((i + 1) * 100, selectedAnime.episodes || 1200)}
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
                            const ep = parseInt((e.target as HTMLInputElement).value);
                            if (ep > 0) playEpisode(selectedAnime.title, ep);
                          }
                        }}
                      />
                      <button 
                        className="anikoto-btn-primary" 
                        style={{ padding: '6px 12px' }}
                        onClick={() => {
                          const input = document.getElementById('jump-episode-input') as HTMLInputElement;
                          const ep = parseInt(input.value);
                          if (ep > 0) playEpisode(selectedAnime.title, ep);
                        }}
                      >
                        Play
                      </button>
                    </div>

                    <div className="episodes-grid">
                      {selectedAnime.episodes === 1 ? (
                        <button className="episode-grid-btn" onClick={() => playEpisode(selectedAnime.title, 1)}>
                          1 (Movie)
                        </button>
                      ) : (
                        Array.from({ length: Math.min(100, (selectedAnime.episodes || 1200) - episodePage * 100) }).map((_, i) => {
                          const epNum = episodePage * 100 + i + 1;
                          return (
                            <button key={epNum} className="episode-grid-btn" onClick={() => playEpisode(selectedAnime.title, epNum)}>
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
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center', padding: '32px' }}>
            <div style={{ marginBottom: '16px', color: 'var(--accent-primary)', display: 'flex', justifyContent: 'center' }}>
              <MonitorPlay size={48} />
            </div>
            <h2 style={{ marginBottom: '12px', fontSize: '1.5rem', color: 'white' }}>Unique Franchises</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: '1.5' }}>
              You have completed exactly <strong style={{ color: 'white', fontSize: '1.2rem' }}>{uniqueCount}</strong> unique anime series, carefully excluding all sequels, movies, and spin-offs!
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

    </div>
  )
}

export default App
