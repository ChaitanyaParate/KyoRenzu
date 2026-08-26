import { useState, useEffect } from 'react'
import { Sparkles, Music, BookOpen, Star, Search, Image as ImageIcon, Home, Library, Settings, Bell, Menu, Play, Info, X, Type, Hash, CalendarRange, Tv, MonitorPlay, ArrowDownWideNarrow, Filter, FilterX, Building2, Globe } from 'lucide-react'
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

function App() {
  const [activeTab, setActiveTab] = useState('home')
  
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

  // User Library State
  const [userLibrary, setUserLibrary] = useState<any[]>([])
  const [userLibraryLoading, setUserLibraryLoading] = useState(false)
  const [userLibraryStatusFilter, setUserLibraryStatusFilter] = useState('All')

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
    if (!animeInput.trim()) {
      setError("Please enter some anime titles you like.")
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
          top_n: topN
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

  const addToLibrary = async (anime: any) => {
    try {
      const response = await fetch('http://localhost:8000/api/user_library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mal_id: anime.mal_id })
      })
      if (response.ok) {
        alert("Added to Library successfully!")
        fetchUserLibrary()
      }
    } catch (err) {
      console.error("Failed to add to library:", err)
    }
  }

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="brand">
          <Menu className="brand-icon" size={24} />
          <span>Anikoto</span>
        </div>
        
        <nav className="nav-menu">
          <div className={`nav-item ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')} title="Home">
            <Home size={24} />
          </div>
          <div className={`nav-item ${activeTab === 'search' ? 'active' : ''}`} onClick={() => setActiveTab('search')} title="Directory Search">
            <Search size={24} />
          </div>
          <div className={`nav-item ${activeTab === 'discover' ? 'active' : ''}`} onClick={() => setActiveTab('discover')} title="AI Discover">
            <Sparkles size={24} />
          </div>
          <div className={`nav-item ${activeTab === 'library' ? 'active' : ''}`} onClick={() => setActiveTab('library')} title="My Library">
            <Library size={24} />
          </div>
          <div className={`nav-item ${activeTab === 'notifications' ? 'active' : ''}`} onClick={() => setActiveTab('notifications')} title="Notifications">
            <Bell size={24} />
          </div>
          <div className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')} title="Settings">
            <Settings size={24} />
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
                            <p className="hero-synopsis">{hero.synopsis}</p>
                            <div className="hero-meta" style={{color: '#fff'}}>
                              {hero.genres?.split(',').slice(0,4).join(' • ')}
                            </div>
                            <div className="hero-actions">
                              <button className="btn-primary" onClick={() => playVideo(hero.title, hero.theme_url)}>
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
              <div className="form-group full">
                <label className="input-label"><Star size={14} /> Your Reference Library</label>
                <input 
                  type="text"
                  className="input-field" 
                  placeholder="e.g. Death Note, Attack on Titan"
                  value={animeInput}
                  onChange={(e) => setAnimeInput(e.target.value)}
                />
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
                <span className="profile-rank">Newbie</span>
                
                <div className="profile-stats">
                  <div className="stat"><span>Mana</span> <strong>73</strong></div>
                  <div className="stat"><span>Join date</span> <strong>Jun 14, 2026</strong></div>
                  <div className="stat"><span>Watch list</span> <strong>{userLibrary.length}</strong></div>
                </div>
              </div>
            </div>

            {/* Status Tabs */}
            <div className="library-tabs">
              {['All', 'Watching', 'On-Hold', 'Planned', 'Dropped', 'Watched'].map(status => (
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
              <input type="text" placeholder="Search..." className="filter-input" />
              <select className="filter-select"><option>Select genre</option></select>
              <select className="filter-select"><option>Select season</option></select>
              <select className="filter-select"><option>Select year</option></select>
              <select className="filter-select"><option>Select type</option></select>
              <select className="filter-select"><option>Select status</option></select>
              <button className="filter-btn">Filter</button>
            </div>

            {/* List View */}
            {userLibraryLoading ? (
               <div className="loader-container"><div className="spinner"></div></div>
            ) : (
              <div className="library-list">
                {userLibrary
                  .filter(item => userLibraryStatusFilter === 'All' || item.status === userLibraryStatusFilter)
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
                    <span className="stat-item"><Tv size={16} /> Format: {selectedAnime.type || (selectedAnime.episodes === 1 ? 'Movie' : 'TV Series')}</span>
                    <span className="stat-item"><Play size={16} /> Episodes: {selectedAnime.episodes || '?'}</span>
                    {selectedAnime.members && (
                      <span className="stat-item">Reviews: {selectedAnime.members.toLocaleString()}</span>
                    )}
                  </div>
                  
                  <div className="anikoto-modal-actions">
                    <button className="anikoto-btn-play" onClick={() => playVideo(selectedAnime.title, selectedAnime.theme_url)}>
                      <Play size={18} fill="currentColor" /> Watch Now
                    </button>
                    <button className="anikoto-btn-icon" onClick={() => addToLibrary(selectedAnime)} title="Add to Library">
                      <Library size={18} />
                    </button>
                    <button className="anikoto-btn-icon" onClick={() => playVideo(selectedAnime.title, selectedAnime.theme_url)} title="YouTube">
                      <Play size={18} />
                    </button>
                  </div>
                  
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
                    <p className="synopsis-text">{selectedAnime.synopsis || "No synopsis available."}</p>
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
                              <span className="rec-meta">{rec.year || '?'} • {rec.episodes ? `${rec.episodes} Ep` : 'Movie'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Right: Episodes List */}
                <div className="anikoto-modal-right">
                  <h3 style={{marginBottom: '16px', color: 'white', fontSize: '1.2rem'}}>Episodes</h3>
                  <div className="episodes-list">
                    {selectedAnime.episodes === 1 ? (
                      <div className="anikoto-episode-card" onClick={() => playVideo(selectedAnime.title + ' Movie', selectedAnime.theme_url)}>
                        <div className="episode-thumb">
                          <img src={selectedAnime.cover_url || './no_image_cover.jpg'} alt="Movie" />
                          <div className="episode-play-overlay">
                            <Play size={20} fill="white" />
                          </div>
                        </div>
                        <div className="episode-info">
                          <div className="episode-title">The Movie</div>
                          <div className="episode-meta">1h 46m</div>
                        </div>
                      </div>
                    ) : (
                      Array.from({ length: selectedAnime.episodes || 12 }).map((_, i) => (
                        <div key={i} className="anikoto-episode-card" onClick={() => playVideo(selectedAnime.title + ` Episode ${i+1}`, selectedAnime.theme_url)}>
                          <div className="episode-thumb">
                            <img src={selectedAnime.cover_url || './no_image_cover.jpg'} alt={`Episode ${i+1}`} />
                            <div className="episode-play-overlay">
                              <Play size={20} fill="white" />
                            </div>
                          </div>
                          <div className="episode-info">
                            <div className="episode-title">Episode {i + 1}</div>
                            <div className="episode-meta">24m</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
      </main>

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
    </div>
  )
}

export default App
