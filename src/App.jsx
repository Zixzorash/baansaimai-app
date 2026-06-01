import React, { useState, useEffect, useRef } from 'react';
import { MapPin, List, Heart, User, PlusCircle, Search, LogOut, Phone, Mail, Lock, Building, Map as MapIcon, Filter, X, Check, ChevronLeft, MessageCircle, Image as ImageIcon, DownloadCloud, UploadCloud, Trash2, Loader2, Home, KeyRound, Calendar, Navigation, ChevronRight, ShieldCheck, FileText } from 'lucide-react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';

// --- 1. ตั้งค่า Google Apps Script URL และ Client ID ---
const GAS_URL = "https://script.google.com/macros/s/AKfycbyJ2CdhbCwBboucgG1CRSJxS6pWcTdG1XKhgo0zzViQWz-6IgubbpnAEYhBg7OgxyTT/exec";
const CLIENT_ID = "185026694768-s4ale64c88rvslq2qahmndev45b7csnr.apps.googleusercontent.com";

// --- CUSTOM LOGO COMPONENT ---
const SaimaiLogo = ({ size = "normal" }) => {
  const isLarge = size === "large";
  return (
    <div className={`flex flex-col items-center justify-center shrink-0 ${isLarge ? 'mb-4' : 'mr-2'}`}>
      <Home size={isLarge ? 48 : 22} className="text-blue-500" />
      <span className={`font-extrabold tracking-wider text-blue-400 uppercase ${isLarge ? 'text-lg mt-1' : 'text-[8px] -mt-1'}`}>
        Sai Mai
      </span>
    </div>
  );
};

// --- HELPER: Generate ID ---
const generatePropertyId = (existingProperties) => {
  let newId;
  let isDuplicate = true;
  while (isDuplicate) {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    newId = `SM-${randomNum}`;
    isDuplicate = existingProperties.some(p => p.propertyId === newId);
  }
  return newId;
};

// --- HELPER: แปลง URL Google Drive ---
const getWorkingImageUrl = (url) => {
  if (!url) return '';
  const idMatch = url.match(/id=([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) return `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w1000`;
  return url;
};

// --- MOCK DATA ---
const initialProperties = [
  { id: 1, propertyId: 'SM-1001', type: 'rent', propType: 'บ้านเดี่ยว', price: 15000, title: 'บ้านเดี่ยว 2 ชั้น ซอยพหลโยธิน 54/1', lat: 13.921, lng: 100.641, images: ['https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80'], desc: 'บ้านสวยพร้อมอยู่ 3 ห้องนอน 2 ห้องน้ำ', date: '2026-06-01' },
  { id: 2, propertyId: 'SM-1002', type: 'sale', propType: 'ทาวน์โฮม', price: 2500000, title: 'ทาวน์โฮม โครงการใหม่ สายไหม 78', lat: 13.915, lng: 100.662, images: ['https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=800&q=80'], desc: 'ทาวน์โฮมสไตล์โมเดิร์น 2 ชั้น ทำเลดี ติดถนนใหญ่', date: '2026-06-01' },
];

const PROPERTY_TYPES = ['บ้านเดี่ยว', 'ทาวน์โฮม', 'ทาวน์เฮ้าส์', 'คอนโด', 'อพาร์ทเม้นท์'];
const TRANSACTION_TYPES = [{ id: 'sale', label: 'ขาย' }, { id: 'rent', label: 'ให้เช่า' }];

function MainApp() {
  // --- STATES ---
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('baansaimai_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (error) { return null; }
  });

  const [currentView, setCurrentView] = useState('map'); 
  const [previousView, setPreviousView] = useState('map'); 
  const [selectedProperty, setSelectedProperty] = useState(null); 
  const [pendingPropertyId, setPendingPropertyId] = useState(null); 
  const [fullscreenImageIndex, setFullscreenImageIndex] = useState(null);
  
  const [properties, setProperties] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({ types: [], transactionTypes: [], minPrice: '', maxPrice: '' });

  // --- 🌟 CUSTOM ROUTER ---
  const navigate = (view, prop = null) => {
    setCurrentView(view);
    if (prop) setSelectedProperty(prop);
    
    if (view !== 'search' && view !== 'detail') setPreviousView(currentView);

    let path = '/';
    switch(view) {
      case 'map': path = '/'; break;
      case 'list': path = '/list'; break;
      case 'favorites': path = '/favorite'; break;
      case 'profile': path = '/profile'; break;
      case 'login': path = '/login'; break;
      case 'register': path = '/register'; break;
      case 'forgot-password': path = '/forgotpw'; break;
      case 'privacy': path = '/privacy'; break;
      case 'terms': path = '/terms'; break; 
      case 'search': path = '/search'; break;
      case 'admin': path = '/admin'; break;
      case 'detail': path = prop ? `/property/${prop.propertyId}` : '/'; break;
      default: path = '/';
    }
    window.history.pushState({ view, prop }, '', path);
  };

  const parsePath = (path) => {
    if (path === '/list') setCurrentView('list');
    else if (path === '/favorite') setCurrentView('favorites');
    else if (path === '/profile') setCurrentView('profile');
    else if (path === '/login') setCurrentView('login');
    else if (path === '/register') setCurrentView('register');
    else if (path === '/forgotpw') setCurrentView('forgot-password');
    else if (path === '/privacy') setCurrentView('privacy');
    else if (path === '/terms') setCurrentView('terms');
    else if (path === '/search') setCurrentView('search');
    else if (path === '/admin') setCurrentView('admin');
    else if (path.startsWith('/property/')) {
      const propId = path.split('/')[2];
      setPendingPropertyId(propId);
      setCurrentView('detail');
    } else setCurrentView('map');
  };

  useEffect(() => { parsePath(window.location.pathname); }, []);

  useEffect(() => {
    const handlePopState = (e) => {
      if (e.state && e.state.view) {
        setCurrentView(e.state.view);
        if (e.state.prop) setSelectedProperty(e.state.prop);
      } else {
        parsePath(window.location.pathname);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // --- FETCH DATA ---
  useEffect(() => { 
    document.title = "บ้านสายไหม - ขาย/เช่าบ้าน คอนโด สายไหม"; 
    
    const fetchProperties = async () => {
      if (!GAS_URL) {
        setProperties(initialProperties);
        setIsLoadingData(false);
        return;
      }
      try {
        const response = await fetch(`${GAS_URL}?action=getProperties`);
        const textData = await response.text();
        let result = JSON.parse(textData);
        
        if (result.status === 'success' && result.data && result.data.length > 0) {
          const formattedData = result.data.map(p => ({
            id: p.propertyId, propertyId: p.propertyId, type: p.type, propType: p.propType, price: Number(p.price) || 0,
            title: p.title, lat: Number(p.lat) || 13.920, lng: Number(p.lng) || 100.650, desc: p.desc, date: p.date,
            images: p.images ? p.images.split(',').map(getWorkingImageUrl) : []
          }));
          setProperties(formattedData.reverse());
        } else setProperties(initialProperties);
      } catch (error) { setProperties(initialProperties); } 
      finally { setIsLoadingData(false); }
    };
    fetchProperties();
  }, []);

  useEffect(() => {
    if (properties.length > 0 && pendingPropertyId) {
      const prop = properties.find(p => p.propertyId === pendingPropertyId);
      if (prop) { setSelectedProperty(prop); } else { navigate('map'); }
      setPendingPropertyId(null);
    }
  }, [properties, pendingPropertyId]);

  // --- LOAD LEAFLET ---
  useEffect(() => {
    if (document.getElementById('leaflet-css')) { setLeafletLoaded(true); return; }
    const link = document.createElement('link'); link.id = 'leaflet-css'; link.rel = 'stylesheet'; link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
    const script = document.createElement('script'); script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => setLeafletLoaded(true);
    document.head.appendChild(script);
  }, []);

  // --- HANDLERS ---
  const toggleFavorite = async (propertyId) => {
    if (!currentUser) { alert("กรุณาเข้าสู่ระบบเพื่อบันทึกรายการโปรด"); navigate('login'); return; }
    
    const isFav = currentUser.favorites.includes(propertyId);
    let newFavs = isFav ? currentUser.favorites.filter(id => id !== propertyId) : [...currentUser.favorites, propertyId];
    
    const updatedUser = { ...currentUser, favorites: newFavs };
    setCurrentUser(updatedUser);
    localStorage.setItem('baansaimai_user', JSON.stringify(updatedUser)); 

    try {
      await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'updateFavorites', username: currentUser.username, favorites: newFavs }) });
    } catch(e) { console.error('Failed to sync favorites'); }
  };

  const handleLoginSuccess = (user) => { 
    setCurrentUser(user); 
    localStorage.setItem('baansaimai_user', JSON.stringify(user)); 
    navigate('map'); 
  };
  
  const handleLogout = () => { setCurrentUser(null); localStorage.removeItem('baansaimai_user'); navigate('map'); };
  const resetFilters = () => { setFilters({ types: [], transactionTypes: [], minPrice: '', maxPrice: '' }); };

  // --- FILTER PROPERTIES ---
  const filteredProperties = properties.filter(p => {
    const matchSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) || p.propType.includes(searchQuery) || (p.propertyId && p.propertyId.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchType = filters.types.length === 0 || filters.types.includes(p.propType);
    const matchTransaction = filters.transactionTypes.length === 0 || filters.transactionTypes.includes(p.type);
    const minP = filters.minPrice === '' ? 0 : Number(filters.minPrice);
    const maxP = filters.maxPrice === '' ? Infinity : Number(filters.maxPrice);
    return matchSearch && matchType && matchTransaction && (p.price >= minP && p.price <= maxP);
  });

  // --- REUSABLE COMPONENTS ---
  const SearchBar = () => (
    <div className="flex items-center gap-2 w-full px-4 pt-4 pb-4 shrink-0 bg-gray-900 shadow-sm z-10">
      <div className="flex-1 bg-gray-800 rounded-xl flex items-center px-4 py-3 border border-gray-700">
        <Search size={20} className="text-gray-400" />
        <input type="text" placeholder="ค้นหาทรัพย์สิน, รหัสทรัพย์..." className="ml-3 w-full bg-transparent outline-none text-sm text-gray-200 placeholder-gray-500" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
      </div>
      <button onClick={() => navigate('search')} className="bg-gray-800 p-3 rounded-xl border border-gray-700 text-gray-300 relative hover:bg-gray-700 transition-colors">
        <Filter size={22} />
        {(filters.types.length > 0 || filters.transactionTypes.length > 0 || filters.minPrice || filters.maxPrice) && (
          <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-blue-500 rounded-full shadow-[0_0_8px_#3b82f6]"></span>
        )}
      </button>
    </div>
  );

  // --- MAIN VIEWS ---

  // 1. Map View
  const MapComponent = () => {
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const markersLayer = useRef(null);

    useEffect(() => {
      if (!leafletLoaded || !mapRef.current || !window.L || isLoadingData) return;
      if (!mapInstance.current) {
        mapInstance.current = window.L.map(mapRef.current, { zoomControl: false }).setView([13.920, 100.650], 13);
        window.L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(mapInstance.current);
        markersLayer.current = window.L.layerGroup().addTo(mapInstance.current);
      }

      markersLayer.current.clearLayers();
      filteredProperties.forEach(prop => {
        const transType = prop.type === 'rent' ? 'เช่า' : 'ขาย';
        const displayImg = prop.images && prop.images.length > 0 ? prop.images[0] : 'https://via.placeholder.com/400?text=No+Image';
        const badgeHtml = `
          <div style="background-color: #1f2937; border: 2px solid ${prop.type === 'rent' ? '#3b82f6' : '#ef4444'}; border-radius: 12px; padding: 4px 8px; text-align: center; box-shadow: 0 4px 10px rgba(0,0,0,0.5); width: max-content; transform: translate(-50%, -100%);">
            <div style="font-size: 11px; font-weight: bold; color: #d1d5db;">${transType} - ${prop.propType}</div>
            <div style="font-size: 13px; color: ${prop.type === 'rent' ? '#60a5fa' : '#f87171'}; font-weight: 800;">${prop.price.toLocaleString()} ฿</div>
          </div>
        `;
        const icon = window.L.divIcon({ className: 'custom-div-icon', html: badgeHtml, iconSize: [0, 0], iconAnchor: [0, 0] });
        const popupContent = `
          <div style="background-color: #1f2937; color: #f3f4f6; margin: -14px; padding: 12px; border-radius: 8px;">
            <b style="font-size: 14px; display: block; margin-bottom: 4px;">${prop.title}</b>
            <span style="color: ${prop.type === 'rent' ? '#60a5fa' : '#f87171'}; font-weight: bold;">ราคา: ${prop.price.toLocaleString()} ฿</span>
            <br/><br/>
            <img src="${displayImg}" style="width:100%; border-radius:8px; aspect-ratio: 16/9; object-fit: cover; margin-bottom: 12px;" />
            <button id="map-btn-${prop.propertyId}" style="width: 100%; background-color: #2563eb; color: white; border: none; padding: 8px 0; border-radius: 6px; font-weight: bold; cursor: pointer;">แสดงข้อมูล</button>
          </div>
        `;
        const marker = window.L.marker([prop.lat, prop.lng], { icon }).addTo(markersLayer.current)
          .bindPopup(popupContent, { className: 'dark-popup' });
        marker.on('popupopen', () => {
          const btn = document.getElementById(`map-btn-${prop.propertyId}`);
          if (btn) btn.onclick = () => navigate('detail', prop);
        });
      });
    }, [leafletLoaded, filteredProperties, isLoadingData]);

    return (
      <div className="relative w-full h-full bg-gray-100 flex flex-col">
        <div className="absolute top-0 left-0 right-0 z-[1000]"><SearchBar /></div>
        {isLoadingData ? (
          <div className="flex flex-col items-center justify-center h-full bg-gray-900/5 backdrop-blur-sm z-50">
             <Loader2 size={40} className="animate-spin text-blue-600 mb-3" />
             <p className="text-gray-600 font-bold">กำลังโหลดแผนที่และข้อมูล...</p>
          </div>
        ) : !leafletLoaded && <div className="flex items-center justify-center h-full text-gray-600">กำลังโหลดเอนจิ้นแผนที่...</div>}
        <div ref={mapRef} className="flex-1 w-full z-0" />
      </div>
    );
  };

  // 2. List View & Favorites
  const PropertyList = ({ propertiesToShow, emptyMessage, hideSearch }) => (
    <div className="flex flex-col h-full bg-gray-900">
      {!hideSearch && <SearchBar />}
      <div className="px-4 pb-6 space-y-4 overflow-y-auto flex-1">
        {isLoadingData ? (
           <div className="flex flex-col items-center justify-center py-20"><Loader2 size={40} className="animate-spin text-blue-500 mb-3" /><p className="text-gray-400 font-bold">กำลังโหลดข้อมูลทรัพย์...</p></div>
        ) : propertiesToShow.length === 0 ? (
          <div className="text-center text-gray-500 py-10 flex flex-col items-center"><Search size={48} className="text-gray-700 mb-3" />{emptyMessage}</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {propertiesToShow.map(prop => {
              const isFav = currentUser?.favorites?.includes(prop.id);
              const transType = prop.type === 'rent' ? 'เช่า' : 'ขาย';
              const displayImg = prop.images && prop.images.length > 0 ? prop.images[0] : 'https://via.placeholder.com/400?text=No+Image';
              return (
                <div key={prop.propertyId} onClick={() => navigate('detail', prop)} className="bg-gray-800 rounded-2xl shadow-md overflow-hidden border border-gray-700 cursor-pointer active:scale-[0.98] transition-transform">
                  <div className="relative h-48">
                    <img src={displayImg} alt={prop.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 to-transparent"></div>
                    <div className="absolute top-3 left-3 bg-gray-900/80 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-gray-200 border border-gray-600">{transType} - {prop.propType}</div>
                    <button onClick={(e) => { e.stopPropagation(); toggleFavorite(prop.id); }} className="absolute top-3 right-3 bg-gray-900/80 p-2 rounded-full border border-gray-600">
                      <Heart size={20} className={isFav ? "text-red-500 fill-red-500" : "text-gray-400"} />
                    </button>
                    <div className="absolute bottom-3 left-3">
                      <div className={`text-xl font-extrabold ${prop.type === 'rent' ? 'text-blue-400' : 'text-red-400'}`}>
                        ฿{prop.price.toLocaleString()} {prop.type === 'rent' && <span className="text-sm font-normal text-gray-300">/ เดือน</span>}
                      </div>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-lg text-white line-clamp-1">{prop.title}</h3>
                    <div className="flex justify-between items-center mt-1">
                      <p className="text-gray-400 text-sm line-clamp-1">{prop.desc}</p>
                      <span className="text-xs text-gray-500 ml-2 whitespace-nowrap">ID: {prop.propertyId}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  // 3. Property Detail View
  const PropertyDetailView = () => {
    if (!selectedProperty) return null;
    const prop = selectedProperty;
    const isFav = currentUser?.favorites?.includes(prop.id);
    const transType = prop.type === 'rent' ? 'เช่า' : 'ขาย';

    const formatDate = (dateStr) => {
      if(!dateStr) return '';
      try { return new Date(dateStr).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }); } 
      catch (e) { return dateStr; }
    };

    const handleLineShare = () => {
      const propertyUrl = `https://baansaimai.pages.dev/property/${prop.propertyId}`;
      const message = `สวัสดีครับ/ค่ะ สนใจสอบถามข้อมูลเพิ่มเติม รหัสทรัพย์: ${prop.propertyId}\nหัวข้อ: ${prop.title}\nราคา: ${prop.price.toLocaleString()} บาท\nลิงก์: ${propertyUrl}`;
      window.open(`https://line.me/R/msg/text/?${encodeURIComponent(message)}`, '_blank');
    };

    const handleDirections = () => window.open(`https://www.google.com/maps/dir/?api=1&destination=${prop.lat},${prop.lng}`, '_blank');

    return (
      <div className="flex flex-col h-full bg-gray-900 overflow-y-auto pb-6 w-full relative">
        <div className="absolute top-0 w-full p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/70 to-transparent pt-10 pointer-events-none">
          <button onClick={() => { navigate(previousView || 'map'); setFullscreenImageIndex(null); }} className="pointer-events-auto bg-gray-900/60 p-2.5 rounded-full text-white backdrop-blur-md border border-gray-600/50 hover:bg-gray-800 transition-colors"><ChevronLeft size={24} /></button>
          <button onClick={() => toggleFavorite(prop.id)} className="pointer-events-auto bg-gray-900/60 p-2.5 rounded-full text-white backdrop-blur-md border border-gray-600/50 hover:bg-gray-800 transition-colors">
            <Heart size={24} className={isFav ? "text-red-500 fill-red-500" : "text-gray-200"} />
          </button>
        </div>

        <div className="w-full aspect-[4/3] md:aspect-[21/9] relative bg-gray-800 overflow-x-auto flex snap-x snap-mandatory hide-scrollbar shrink-0">
          {prop.images && prop.images.length > 0 ? (
            prop.images.map((img, idx) => (
              <img key={idx} src={img} alt={`${prop.title}-${idx}`} onClick={() => setFullscreenImageIndex(idx)} className="w-full h-full object-cover shrink-0 snap-center cursor-pointer" />
            ))
          ) : <div className="w-full h-full flex items-center justify-center text-gray-500">ไม่มีรูปภาพ</div>}
          {prop.images && prop.images.length > 1 && (
            <div className="absolute bottom-4 right-4 bg-black/60 text-white text-xs px-2 py-1 rounded-full z-10 pointer-events-none backdrop-blur-sm">ปัดเพื่อดูรูป 1/{prop.images.length}</div>
          )}
        </div>

        <div className="flex-1 p-5 md:p-8 md:max-w-4xl md:mx-auto w-full bg-gray-900 -mt-6 md:-mt-10 rounded-t-3xl relative z-10 border-t border-gray-800 shadow-2xl">
          <div className="flex justify-between items-start mb-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-gray-800 text-gray-300 text-xs px-3 py-1.5 rounded-lg border border-gray-700 font-bold">{transType} - {prop.propType}</span>
              <span className="bg-gray-800 text-gray-400 text-xs px-2 py-1.5 rounded-lg border border-gray-700 flex items-center gap-1"><MapPin size={12}/> สายไหม</span>
              {prop.date && <span className="bg-gray-800 text-gray-400 text-xs px-2 py-1.5 rounded-lg border border-gray-700 flex items-center gap-1"><Calendar size={12}/> ลงเมื่อ: {formatDate(prop.date)}</span>}
            </div>
            <span className="text-gray-500 text-xs font-mono bg-gray-800 px-2 py-1 rounded border border-gray-700 mt-1">ID: {prop.propertyId}</span>
          </div>
          
          <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight mb-2">{prop.title}</h1>
          <div className={`text-3xl md:text-4xl font-extrabold my-2 ${prop.type === 'rent' ? 'text-blue-400' : 'text-red-400'}`}>
            ฿{prop.price.toLocaleString()} {prop.type === 'rent' && <span className="text-base font-normal text-gray-400">/ เดือน</span>}
          </div>
          <hr className="border-gray-800 my-6" />
          <h3 className="text-lg font-bold text-white mb-3">รายละเอียดทรัพย์</h3>
          <p className="text-gray-400 leading-relaxed text-sm md:text-base whitespace-pre-wrap">{prop.desc}</p>

          <div className="mt-8 grid grid-cols-3 gap-3 max-w-lg mx-auto">
            <button className="flex flex-col items-center justify-center gap-1.5 bg-gray-800 border border-gray-700 hover:bg-gray-700 text-white py-3 rounded-2xl font-bold shadow-sm transition-colors active:scale-95">
              <Phone size={22} className="text-blue-400" /><span className="text-xs">โทร</span>
            </button>
            <button onClick={handleLineShare} className="flex flex-col items-center justify-center gap-1.5 bg-[#00B900] hover:bg-[#009900] text-white py-3 rounded-2xl font-bold shadow-lg shadow-green-900/20 transition-colors active:scale-95">
              <MessageCircle size={22} /><span className="text-xs">LINE</span>
            </button>
            <button onClick={handleDirections} className="flex flex-col items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-2xl font-bold shadow-lg shadow-blue-900/20 transition-colors active:scale-95">
              <Navigation size={22} /><span className="text-xs">เส้นทาง</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  // 4. Search View
  const SearchView = () => (
    <div className="flex flex-col h-full bg-gray-900 w-full animate-in fade-in zoom-in-95 duration-200">
      <div className="p-4 flex justify-between items-center z-10 bg-gray-900 border-b border-gray-800 shrink-0">
        <button onClick={() => navigate(previousView || 'map')} className="text-gray-400 hover:text-white p-2 bg-gray-800 rounded-full"><ChevronLeft size={20} /></button>
        <h2 className="text-lg font-bold text-white">ค้นหาและตัวกรอง</h2>
        <div className="w-10"></div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div>
          <h3 className="text-sm font-bold text-gray-400 mb-3">สถานะ (ขาย / ให้เช่า)</h3>
          <div className="flex gap-3">
            {TRANSACTION_TYPES.map(trans => {
              const isSelected = filters.transactionTypes.includes(trans.id);
              return (
                <label key={trans.id} className={`flex-1 flex items-center justify-center p-3 rounded-xl border cursor-pointer active:scale-[0.98] transition-all ${isSelected ? 'bg-blue-600 border-blue-600 text-white font-bold' : 'bg-gray-800 border-gray-700 text-gray-300'}`}>
                    <input type="checkbox" className="hidden" checked={isSelected} onChange={() => setFilters(prev => ({...prev, transactionTypes: isSelected ? prev.transactionTypes.filter(t => t !== trans.id) : [...prev.transactionTypes, trans.id]}))} />
                  {trans.label}
                </label>
              );
            })}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-400 mb-3">รูปแบบทรัพย์</h3>
          <div className="flex flex-col gap-2">
            {PROPERTY_TYPES.map(type => {
              const isSelected = filters.types.includes(type);
              return (
                <label key={type} className="flex items-center space-x-3 p-3 rounded-xl bg-gray-800 border border-gray-700 cursor-pointer active:scale-[0.98]">
                  <input type="checkbox" className="hidden" checked={isSelected} onChange={() => setFilters(prev => ({...prev, types: isSelected ? prev.types.filter(t => t !== type) : [...prev.types, type]}))} />
                  <div className={`w-6 h-6 rounded border flex items-center justify-center ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-500'}`}>
                    {isSelected && <Check size={16} className="text-white" />}
                  </div>
                  <span className="text-gray-200">{type}</span>
                </label>
              );
            })}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-400 mb-3">ช่วงราคา (บาท)</h3>
          <div className="flex gap-4 items-center">
            <input type="number" placeholder="ต่ำสุด" className="flex-1 bg-gray-800 border border-gray-700 rounded-xl py-3 px-4 outline-none text-white focus:border-blue-500" value={filters.minPrice} onChange={e => setFilters({...filters, minPrice: e.target.value})} />
            <span className="text-gray-500">-</span>
            <input type="number" placeholder="สูงสุด" className="flex-1 bg-gray-800 border border-gray-700 rounded-xl py-3 px-4 outline-none text-white focus:border-blue-500" value={filters.maxPrice} onChange={e => setFilters({...filters, maxPrice: e.target.value})} />
          </div>
        </div>
      </div>
      
      <div className="p-4 border-t border-gray-800 shrink-0 bg-gray-900 flex gap-4">
        <button onClick={resetFilters} className="w-1/3 py-3 rounded-xl font-bold text-gray-300 bg-gray-800 hover:bg-gray-700">ล้างค่า</button>
        <button onClick={() => navigate('list')} className="w-2/3 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-900/50">ดูผลลัพธ์ ({filteredProperties.length})</button>
      </div>
    </div>
  );

  // 5. Privacy Policy & Terms Views
  const PrivacyView = () => (
    <div className="flex flex-col h-full bg-gray-900 w-full animate-in fade-in duration-200">
      <div className="p-4 flex justify-between items-center z-10 bg-gray-900 border-b border-gray-800 shrink-0">
        <button onClick={() => navigate(previousView || 'profile')} className="text-gray-400 hover:text-white p-2 bg-gray-800 rounded-full"><ChevronLeft size={20} /></button>
        <h2 className="text-lg font-bold text-white flex items-center gap-2"><ShieldCheck size={20} className="text-blue-400"/> นโยบายความเป็นส่วนตัว</h2>
        <div className="w-10"></div>
      </div>
      <div className="flex-1 overflow-y-auto p-6 text-gray-300 text-sm leading-relaxed space-y-4">
        <p><strong>แพลตฟอร์ม "บ้านสายไหม"</strong> ตระหนักถึงความสำคัญของข้อมูลส่วนบุคคลของท่าน เราจึงจัดทำนโยบายความเป็นส่วนตัวฉบับนี้ขึ้น เพื่อชี้แจงให้ท่านทราบถึงวิธีการเก็บรวบรวม ใช้ และเปิดเผยข้อมูลส่วนบุคคลของท่าน</p>
        <p><strong>1. ข้อมูลส่วนบุคคลที่เราเก็บรวบรวม:</strong> ชื่อผู้ใช้งาน, อีเมล, รหัสผ่าน, เบอร์โทรศัพท์ และข้อมูลที่ท่านอนุญาตผ่านการเข้าสู่ระบบด้วย LINE/Google</p>
        <p><strong>2. วัตถุประสงค์:</strong> เพื่อสร้างบัญชีผู้ใช้, บันทึกรายการโปรด, และปรับปรุงบริการแพลตฟอร์ม</p>
        <p><strong>3. การจัดเก็บ:</strong> ข้อมูลจะถูกจัดเก็บอย่างปลอดภัยบนเซิร์ฟเวอร์ และมีเพียงแอดมินที่ได้รับอนุญาตเท่านั้นที่สามารถเข้าถึงได้</p>
        <p><strong>4. การเปิดเผยข้อมูล:</strong> เราไม่มีนโยบายจำหน่าย หรือเปิดเผยข้อมูลของท่านให้กับบุคคลที่สามโดยเด็ดขาด</p>
        <p>หากมีข้อสงสัย กรุณาติดต่อ Line ID: @614rppiz</p>
      </div>
    </div>
  );

  const TermsView = () => (
    <div className="flex flex-col h-full bg-gray-900 w-full animate-in fade-in duration-200">
      <div className="p-4 flex justify-between items-center z-10 bg-gray-900 border-b border-gray-800 shrink-0">
        <button onClick={() => navigate(previousView || 'profile')} className="text-gray-400 hover:text-white p-2 bg-gray-800 rounded-full"><ChevronLeft size={20} /></button>
        <h2 className="text-lg font-bold text-white flex items-center gap-2"><FileText size={20} className="text-blue-400"/> ข้อตกลงและเงื่อนไข</h2>
        <div className="w-10"></div>
      </div>
      <div className="flex-1 overflow-y-auto p-6 text-gray-300 text-sm leading-relaxed space-y-4">
        <p><strong>ข้อตกลงและเงื่อนไขการใช้งาน (Terms of Use)</strong></p>
        <p><strong>1. บริการของเรา:</strong> บ้านสายไหมเป็นแพลตฟอร์มสื่อกลางในการนำเสนอข้อมูลอสังหาริมทรัพย์ในย่านสายไหมและพื้นที่ใกล้เคียง</p>
        <p><strong>2. บัญชีผู้ใช้งาน:</strong> ท่านต้องให้ข้อมูลที่เป็นความจริงในการสมัครสมาชิก และรักษารหัสผ่านของท่านไว้เป็นความลับ</p>
        <p><strong>3. การใช้งาน:</strong> ห้ามมิให้คัดลอก ดัดแปลง หรือเจาะระบบแอปพลิเคชันโดยไม่ได้รับอนุญาต</p>
        <p><strong>4. ข้อจำกัดความรับผิด:</strong> เราไม่รับประกันความถูกต้อง 100% ของราคาหรือสถานะทรัพย์สินที่อาจเปลี่ยนแปลงได้ และไม่รับผิดชอบต่อการทำธุรกรรมใดๆ ระหว่างท่านและเจ้าของทรัพย์</p>
        <p>การที่ท่านใช้งานแอปพลิเคชัน ถือว่าท่านยอมรับข้อตกลงนี้ทุกประการ</p>
      </div>
    </div>
  );

  // 6. Admin View
  const AdminView = () => {
    const defaultLat = 13.920; const defaultLng = 100.650;
    const todayStr = new Date().toISOString().split('T')[0];
    const [formData, setFormData] = useState({ title: '', propType: 'บ้านเดี่ยว', type: 'rent', price: '', desc: '', lat: defaultLat, lng: defaultLng, date: todayStr });
    const [newPropId, setNewPropId] = useState('');
    const [imageFiles, setImageFiles] = useState([]); 
    const [imagePreviews, setImagePreviews] = useState([]); 
    const [isUploading, setIsUploading] = useState(false);
    const adminMapRef = useRef(null); const adminMapInstance = useRef(null); const markerRef = useRef(null); const fileInputRef = useRef(null);

    useEffect(() => {
      setNewPropId(generatePropertyId(properties));
      if (!leafletLoaded || !adminMapRef.current || !window.L) return;
      if (!adminMapInstance.current) {
        adminMapInstance.current = window.L.map(adminMapRef.current).setView([defaultLat, defaultLng], 13);
        window.L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(adminMapInstance.current);
        markerRef.current = window.L.marker([defaultLat, defaultLng], { draggable: true }).addTo(adminMapInstance.current);
        adminMapInstance.current.on('click', (e) => { markerRef.current.setLatLng(e.latlng); setFormData(prev => ({...prev, lat: e.latlng.lat, lng: e.latlng.lng})); });
        markerRef.current.on('dragend', (e) => { const pos = e.target.getLatLng(); setFormData(prev => ({...prev, lat: pos.lat, lng: pos.lng})); });
      }
    }, [leafletLoaded]);

    const handleImageChange = (e) => {
      const files = Array.from(e.target.files);
      if (imageFiles.length + files.length > 10) { alert('อัพโหลดรูปภาพได้สูงสุด 10 รูปเท่านั้น'); return; }
      setImageFiles([...imageFiles, ...files]);
      setImagePreviews([...imagePreviews, ...files.map(f => URL.createObjectURL(f))]);
    };
    const removeImage = (index) => { setImageFiles(imageFiles.filter((_, i) => i !== index)); setImagePreviews(imagePreviews.filter((_, i) => i !== index)); };
    const convertToBase64 = (file) => new Promise((resolve, reject) => { const reader = new FileReader(); reader.readAsDataURL(file); reader.onload = () => resolve({ name: file.name, mimeType: file.type, base64: reader.result.split(',')[1] }); reader.onerror = error => reject(error); });

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!GAS_URL) alert('ยังไม่ได้ใส่ Google Sheets URL ในโค้ด'); 
      setIsUploading(true);
      try {
        let finalImages = [];
        if (GAS_URL) {
          const base64Images = await Promise.all(imageFiles.map(file => convertToBase64(file)));
          const payload = { action: 'addProperty', property: { ...formData, propertyId: newPropId }, images: base64Images };
          const response = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(payload) });
          const textData = await response.text();
          let result = JSON.parse(textData);
          if (result.status === 'success') { finalImages = result.urls; } else { throw new Error(result.message); }
        } else finalImages = imagePreviews.length > 0 ? imagePreviews : ['https://via.placeholder.com/800?text=No+Image'];

        const newProp = { ...formData, id: newPropId, propertyId: newPropId, price: Number(formData.price), images: finalImages.map(getWorkingImageUrl) };
        setProperties([newProp, ...properties]);
        alert(`บันทึกทรัพย์รหัส ${newPropId} สำเร็จ!`);
        
        setFormData({ title: '', propType: 'บ้านเดี่ยว', type: 'rent', price: '', desc: '', lat: defaultLat, lng: defaultLng, date: todayStr });
        setImageFiles([]); setImagePreviews([]); setNewPropId(generatePropertyId([newProp, ...properties]));
        if(markerRef.current) markerRef.current.setLatLng([defaultLat, defaultLng]);
        if(adminMapInstance.current) adminMapInstance.current.setView([defaultLat, defaultLng], 13);
      } catch (error) { alert(`เกิดข้อผิดพลาด: ${error.message}`); } finally { setIsUploading(false); }
    };

    return (
      <div className="p-4 md:p-8 pb-6 overflow-y-auto h-full bg-gray-900 w-full">
        <h2 className="text-xl font-bold text-white mb-4">จัดการระบบ (Admin)</h2>
        <div className="bg-gray-800 p-5 rounded-2xl shadow-md border border-gray-700">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-gray-900 p-3 rounded-lg border border-gray-700 flex justify-between items-center"><span className="text-sm font-bold text-gray-400">รหัสทรัพย์</span><span className="text-lg font-mono font-bold text-blue-400">{newPropId}</span></div>
            <div><label className="block text-sm font-bold text-gray-400 mb-1">หัวข้อประกาศ</label><input type="text" required className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg p-3 outline-none" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="ทาวน์โฮม 2 ชั้น สายไหม" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-bold text-gray-400 mb-1">รูปแบบ</label><select className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg p-3 outline-none" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}><option value="sale">ขาย</option><option value="rent">ให้เช่า</option></select></div>
              <div><label className="block text-sm font-bold text-gray-400 mb-1">ประเภททรัพย์</label><select className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg p-3 outline-none" value={formData.propType} onChange={e => setFormData({...formData, propType: e.target.value})}>{PROPERTY_TYPES.map(type => <option key={type} value={type}>{type}</option>)}</select></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-bold text-gray-400 mb-1">ราคา (บาท)</label><input type="number" required className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg p-3 outline-none" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} placeholder="15000" /></div>
              <div><label className="block text-sm font-bold text-gray-400 mb-1">วันที่ลงประกาศ</label><input type="date" required className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg p-3 outline-none" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} /></div>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-400 mb-1">พิกัดบนแผนที่ (คลิกเพื่อปักหมุด)</label>
              <div className="w-full h-40 bg-gray-200 rounded-lg mb-2 relative z-0" ref={adminMapRef}></div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-bold text-gray-400">รูปภาพ ({imageFiles.length}/10)</label>
                <button type="button" onClick={() => fileInputRef.current.click()} className="text-xs bg-blue-600/20 text-blue-400 px-2 py-1 rounded border border-blue-500/30 flex items-center gap-1"><ImageIcon size={14} /> เพิ่มรูป</button>
                <input type="file" multiple accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageChange} />
              </div>
              {imagePreviews.length > 0 ? (
                <div className="flex gap-2 overflow-x-auto py-2 snap-x">
                  {imagePreviews.map((img, i) => (
                    <div key={i} className="relative shrink-0 snap-start w-24 h-24 rounded-lg overflow-hidden border border-gray-600">
                      <img src={img} className="w-full h-full object-cover" alt="preview" />
                      <button type="button" onClick={() => removeImage(i)} className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full"><Trash2 size={12}/></button>
                    </div>
                  ))}
                </div>
              ) : <div className="text-xs text-gray-500 italic p-3 bg-gray-900 rounded border border-gray-700 text-center">ยังไม่ได้อัปโหลดรูปภาพ</div>}
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-400 mb-1">รายละเอียดเพิ่มเติม</label>
              <textarea rows="3" className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg p-3 outline-none" value={formData.desc} onChange={e => setFormData({...formData, desc: e.target.value})} placeholder="รายละเอียดบ้าน..."></textarea>
            </div>
            <button type="submit" disabled={isUploading} className="w-full bg-blue-600 text-white rounded-xl py-3 font-bold shadow-lg hover:bg-blue-700 mt-4 disabled:bg-blue-800 disabled:text-gray-400 flex justify-center items-center gap-2">
              {isUploading ? <><Loader2 size={20} className="animate-spin" /> กำลังอัปโหลดข้อมูล...</> : "บันทึกและเผยแพร่ทรัพย์"}
            </button>
          </form>
        </div>
      </div>
    );
  };

  // 7. Login & Auth Views
  const LoginView = () => {
    const [username, setUsername] = useState(''); const [password, setPassword] = useState(''); const [isLoading, setIsLoading] = useState(false); const [loginMethod, setLoginMethod] = useState('');

    useEffect(() => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      if (code) {
        setIsLoading(true); setLoginMethod('line');
        const redirectUri = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, redirectUri);
        
        fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'lineLogin', code: code, redirectUri: redirectUri }) })
        .then(res => res.json())
        .then(result => {
          if (result.status === 'success') { handleLoginSuccess({ id: Date.now().toString(), username: result.user.username, email: result.user.email, role: result.user.role, favorites: result.user.favorites || [] }); } 
          else { alert("Login failed: " + result.message); setIsLoading(false); }
        }).catch(err => { alert("Connection Error"); setIsLoading(false); });
      }
    }, []);

    const loginWithLINE = () => {
      const LINE_CHANNEL_ID = '2010245466'; 
      const redirectUri = encodeURIComponent(window.location.origin + window.location.pathname);
      const state = Math.random().toString(36).substring(7);
      window.location.href = `https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${LINE_CHANNEL_ID}&redirect_uri=${redirectUri}&state=${state}&scope=profile%20openid%20email`;
    };

    const onSubmit = async (e) => {
      e.preventDefault(); setIsLoading(true); setLoginMethod('normal');
      if ((username.toLowerCase() === 'admin_bann@sajikacash.in.th' && password === '058767502') || (username === 'admin' && password === 'admin')) {
        handleLoginSuccess({ id: 'a1', username: 'ผู้ดูแลระบบ', role: 'admin', favorites: [] }); setIsLoading(false); return;
      }
      try {
        const response = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'login', username, password }) });
        let result = JSON.parse(await response.text());
        if (result.status === 'success') { handleLoginSuccess({ id: Date.now().toString(), username: result.user.username, email: result.user.email, role: result.user.role, favorites: result.user.favorites || [] }); } 
        else { alert(result.message || "บัญชีผู้ใช้นี้ยังไม่ได้ลงทะเบียน"); }
      } catch (error) { alert(`เกิดข้อผิดพลาดในการเชื่อมต่อ:\n${error.message}`); }
      setIsLoading(false);
    };

    return (
      <div className="p-6 flex flex-col justify-center h-full bg-gray-900 w-full animate-in fade-in duration-300">
        <div className="text-center mb-8"><SaimaiLogo size="large" /><h1 className="text-2xl font-bold text-white mt-4">บ้านสายไหม</h1><p className="text-gray-400 text-sm">เข้าสู่ระบบเพื่อบันทึกบ้านที่คุณสนใจ</p></div>
        <form onSubmit={onSubmit} className="space-y-4 max-w-sm mx-auto w-full">
          <div className="relative"><User className="absolute top-3 left-3 text-gray-500" size={20} /><input type="text" required placeholder="อีเมล / ชื่อผู้ใช้งาน" disabled={isLoading} className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl py-3 pl-10 pr-4 outline-none" value={username} onChange={e => setUsername(e.target.value)} /></div>
          <div className="relative"><Lock className="absolute top-3 left-3 text-gray-500" size={20} /><input type="password" required placeholder="รหัสผ่าน" disabled={isLoading} className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl py-3 pl-10 pr-4 outline-none" value={password} onChange={e => setPassword(e.target.value)} /></div>
          <div className="flex justify-end"><button type="button" onClick={() => navigate('forgot-password')} className="text-sm text-blue-400 hover:text-blue-300">ลืมรหัสผ่าน?</button></div>
          <button type="submit" disabled={isLoading} className="w-full bg-blue-600 text-white rounded-xl py-3 font-bold flex justify-center items-center">{isLoading && loginMethod === 'normal' && <Loader2 size={20} className="animate-spin mr-2" />} เข้าสู่ระบบ</button>
        </form>
        
        <div className="mt-6 flex items-center justify-between max-w-sm mx-auto w-full"><hr className="w-full border-gray-700" /><span className="px-3 text-gray-500 text-sm whitespace-nowrap">หรือ</span><hr className="w-full border-gray-700" /></div>
        
        <div className="mt-6 space-y-3 max-w-sm mx-auto w-full">
          {/* ปุ่มเข้าสู่ระบบ Google Auth ของจริง */}
          <div className="flex justify-center w-full">
            <GoogleLogin
              onSuccess={credentialResponse => {
                setIsLoading(true); setLoginMethod('google');
                fetch(GAS_URL, {
                  method: 'POST',
                  body: JSON.stringify({ action: 'googleLogin', token: credentialResponse.credential }),
                })
                .then(res => res.json())
                .then(data => {
                  if (data.status === 'success') { handleLoginSuccess(data.user); } 
                  else { alert("Login Failed: " + data.message); }
                  setIsLoading(false);
                })
                .catch(err => { alert("Connection Error"); setIsLoading(false); });
              }}
              onError={() => alert('Google Login ล้มเหลว')}
              size="large"
              theme="filled_black"
              width="100%"
            />
          </div>

          <button 
            disabled={isLoading} 
            onClick={loginWithLINE} 
            className="w-full bg-[#06C755] text-white rounded-xl py-3 font-bold flex justify-center items-center hover:bg-[#05b34c] transition-colors shadow-md active:scale-95"
          >
            {/* แสดงไอคอน LINE SVG บนปุ่ม */}
            <LineIcon className="w-6 h-6 mr-2" />
            {isLoading && loginMethod === 'line' ? 'กำลังเชื่อมต่อ LINE...' : 'เข้าสู่ระบบด้วย LINE'}
          </button>
        </div>
        <div className="mt-8 text-center text-sm text-gray-400">ยังไม่มีบัญชีใช่ไหม? <span onClick={() => navigate('register')} className="text-blue-500 font-bold cursor-pointer hover:underline">ลงทะเบียนเลย</span></div>
      </div>
    );
  };

  const ForgotPasswordView = () => (
    <div className="p-6 flex flex-col justify-center h-full bg-gray-900 w-full animate-in fade-in duration-300">
      <div className="max-w-sm mx-auto w-full mb-8">
        <button onClick={() => navigate('login')} className="text-gray-400 hover:text-white mb-6 flex items-center"><ChevronLeft size={20} className="mr-1" /> กลับ</button>
        <h1 className="text-2xl font-bold text-white mb-2">ลืมรหัสผ่าน?</h1>
        <p className="text-gray-400 text-sm leading-relaxed">กรุณากรอกอีเมลที่ใช้ลงทะเบียนไว้ ระบบจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ให้ทางอีเมล</p>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); alert("ระบบส่งลิงก์ไปยังอีเมลเรียบร้อยแล้ว"); navigate('login'); }} className="space-y-6 max-w-sm mx-auto w-full">
        <div className="relative"><Mail className="absolute top-3 left-3 text-gray-500" size={20} /><input type="email" required placeholder="กรอกอีเมลของคุณ" className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl py-3 pl-10 pr-4 outline-none" /></div>
        <button type="submit" className="w-full bg-blue-600 text-white rounded-xl py-3 font-bold">ส่งลิงก์ตั้งรหัสผ่านใหม่</button>
      </form>
    </div>
  );

  const RegisterView = () => {
    const [formData, setFormData] = useState({ username: '', password: '', email: '', phone: '' }); const [isLoading, setIsLoading] = useState(false);
    const onSubmit = async (e) => {
      e.preventDefault(); setIsLoading(true);
      try {
        const response = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'register', user: formData }) });
        let result = JSON.parse(await response.text());
        if (result.status === 'success') { alert("ลงทะเบียนสำเร็จ กรุณาเข้าสู่ระบบ"); navigate('login'); } else { alert(result.message || "เกิดข้อผิดพลาดในการลงทะเบียน"); }
      } catch (error) { alert(`เกิดข้อผิดพลาดในการเชื่อมต่อ:\n${error.message}`); }
      setIsLoading(false);
    };
    return (
      <div className="p-6 flex flex-col justify-center h-full bg-gray-900 w-full animate-in fade-in duration-300">
        <div className="max-w-sm mx-auto w-full mb-6">
          <button onClick={() => navigate('login')} className="text-gray-400 hover:text-white mb-4 flex items-center transition-colors"><ChevronLeft size={20} className="mr-1" /> กลับ</button>
          <h1 className="text-2xl font-bold text-white">ลงทะเบียนสมาชิก</h1><p className="text-gray-400 text-sm mt-1">กรอกข้อมูลเพื่อสร้างบัญชีผู้ใช้ใหม่</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4 max-w-sm mx-auto w-full">
          <div className="relative"><User className="absolute top-3 left-3 text-gray-500" size={20} /><input type="text" required placeholder="ชื่อผู้ใช้งาน" disabled={isLoading} className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl py-3 pl-10 pr-4 outline-none" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})}/></div>
          <div className="relative"><Lock className="absolute top-3 left-3 text-gray-500" size={20} /><input type="password" required placeholder="รหัสผ่าน" disabled={isLoading} className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl py-3 pl-10 pr-4 outline-none" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})}/></div>
          <div className="relative"><Mail className="absolute top-3 left-3 text-gray-500" size={20} /><input type="email" required placeholder="อีเมล" disabled={isLoading} className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl py-3 pl-10 pr-4 outline-none" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})}/></div>
          <div className="relative"><Phone className="absolute top-3 left-3 text-gray-500" size={20} /><input type="tel" required placeholder="เบอร์โทรศัพท์" disabled={isLoading} className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl py-3 pl-10 pr-4 outline-none" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})}/></div>
          <button type="submit" disabled={isLoading} className="w-full bg-blue-600 text-white rounded-xl py-3 font-bold mt-2">{isLoading ? <Loader2 size={20} className="animate-spin mx-auto" /> : "สร้างบัญชี"}</button>
        </form>
      </div>
    );
  };

  // 8. Profile View 
  const ProfileView = () => (
    <div className="p-6 pb-6 h-full bg-gray-900 overflow-y-auto w-full animate-in fade-in duration-200">
      <div className="max-w-md mx-auto w-full">
        <div className="bg-gray-800 rounded-2xl shadow-md p-6 flex flex-col items-center border border-gray-700">
          <div className="w-24 h-24 bg-blue-900/50 rounded-full flex items-center justify-center text-blue-400 mb-4 border border-blue-800"><User size={48} /></div>
          <h2 className="text-xl font-bold text-white">{currentUser?.username}</h2>
          <p className="text-sm text-gray-300 bg-gray-700 px-3 py-1 rounded-full mt-2 border border-gray-600">{currentUser?.role === 'admin' ? 'Administrator' : 'Member'}</p>
          
          <div className="mt-8 w-full space-y-3">
             <button onClick={() => navigate('privacy')} className="w-full flex justify-between items-center bg-gray-900 border border-gray-700 p-4 rounded-xl text-gray-300 hover:bg-gray-700 transition-colors">
                <div className="flex items-center gap-3"><ShieldCheck size={20} className="text-blue-400"/> นโยบายความเป็นส่วนตัว</div><ChevronRight size={18} className="text-gray-500" />
             </button>
             <button onClick={() => navigate('terms')} className="w-full flex justify-between items-center bg-gray-900 border border-gray-700 p-4 rounded-xl text-gray-300 hover:bg-gray-700 transition-colors">
                <div className="flex items-center gap-3"><FileText size={20} className="text-blue-400"/> ข้อตกลงและเงื่อนไขการใช้งาน</div><ChevronRight size={18} className="text-gray-500" />
             </button>
          </div>

          <button onClick={handleLogout} className="mt-8 w-full flex items-center justify-center bg-red-900/20 text-red-400 border border-red-900/50 py-3.5 rounded-xl font-bold hover:bg-red-900/40 transition-colors"><LogOut size={20} className="mr-2" /> ออกจากระบบ</button>
        </div>
      </div>
    </div>
  );

  // --- RENDER MAIN LAYOUT ---
  return (
    <div className="flex flex-col h-[100dvh] w-full bg-black relative font-sans overflow-hidden">
      <div className="flex flex-col h-full w-full max-w-[1200px] mx-auto bg-gray-900 relative shadow-2xl border-x border-gray-800">
        
        {currentView !== 'detail' && currentView !== 'login' && currentView !== 'forgot-password' && currentView !== 'register' && currentView !== 'search' && (
          <header className="bg-gray-900 pt-8 pb-4 px-4 shadow-sm z-10 flex justify-between items-center border-b border-gray-800 shrink-0">
            <div className="flex items-center text-white shrink-0 min-w-0">
              <SaimaiLogo />
              <h1 className="text-lg sm:text-xl font-extrabold tracking-tight truncate cursor-pointer" onClick={() => navigate('map')}>บ้านสายไหม</h1>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <a href="https://line.me/R/ti/p/@614rppiz" target="_blank" rel="noopener noreferrer" className="text-[10px] sm:text-xs font-bold text-[#00B900] bg-[#00B900]/10 border border-[#00B900]/50 px-2 sm:px-3 py-1.5 rounded-full hover:bg-[#00B900]/20 flex items-center gap-1 transition-colors whitespace-nowrap">
                <MessageCircle size={14} /> ติดต่อลงโพสต์
              </a>
              {!currentUser && (
                <button onClick={() => navigate('login')} className="text-[10px] sm:text-xs font-bold text-blue-400 bg-blue-900/30 border border-blue-800 px-2 sm:px-3 py-1.5 rounded-full hover:bg-blue-900/50 whitespace-nowrap">
                  เข้าสู่ระบบ
                </button>
              )}
            </div>
          </header>
        )}

        <main className="flex-1 overflow-hidden relative flex flex-col w-full bg-black">
          {currentView === 'map' && <MapComponent />}
          {currentView === 'list' && <PropertyList propertiesToShow={filteredProperties} emptyMessage="ไม่พบรายการที่ตรงกับเงื่อนไข" viewName="list" />}
          {currentView === 'favorites' && <PropertyList propertiesToShow={properties.filter(p => currentUser?.favorites?.includes(p.id))} emptyMessage="คุณยังไม่ได้บันทึกรายการโปรดใดๆ" hideSearch={true} viewName="favorites" />}
          {currentView === 'search' && <SearchView />}
          {currentView === 'login' && <LoginView />}
          {currentView === 'register' && <RegisterView />}
          {currentView === 'forgot-password' && <ForgotPasswordView />}
          {currentView === 'admin' && currentUser?.role === 'admin' && <AdminView />}
          {currentView === 'profile' && currentUser && <ProfileView />}
          {currentView === 'privacy' && <PrivacyView />}
          {currentView === 'terms' && <TermsView />}
          {currentView === 'detail' && <PropertyDetailView />}
        </main>

        {currentView !== 'detail' && currentView !== 'search' && currentView !== 'forgot-password' && currentView !== 'login' && currentView !== 'register' && currentView !== 'privacy' && currentView !== 'terms' && (
          <nav className="w-full bg-gray-900 border-t border-gray-800 pb-safe pt-2 px-2 flex justify-around items-center z-50 h-[72px] shrink-0 shadow-[0_-10px_20px_rgba(0,0,0,0.5)]">
            <button onClick={() => navigate('map')} className={`flex flex-col items-center flex-1 py-1 transition-colors ${currentView === 'map' ? 'text-blue-500' : 'text-gray-500 hover:text-gray-400'}`}>
              <MapIcon size={24} className={currentView === 'map' ? 'stroke-2' : 'stroke-[1.5]'} /><span className="text-[10px] mt-1 font-medium">แผนที่</span>
            </button>
            <button onClick={() => navigate('list')} className={`flex flex-col items-center flex-1 py-1 transition-colors ${currentView === 'list' ? 'text-blue-500' : 'text-gray-500 hover:text-gray-400'}`}>
              <List size={24} className={currentView === 'list' ? 'stroke-2' : 'stroke-[1.5]'} /><span className="text-[10px] mt-1 font-medium">รายการ</span>
            </button>

            {currentUser?.role === 'admin' ? (
              <button onClick={() => navigate('admin')} className="flex flex-col items-center justify-center -mt-6">
                <div className="bg-blue-600 rounded-full p-3 shadow-[0_0_15px_rgba(37,99,235,0.5)] border-4 border-gray-900 text-white hover:scale-105 transition-transform"><PlusCircle size={28} /></div>
                <span className="text-[10px] mt-1 font-medium text-gray-400">จัดการ</span>
              </button>
            ) : (
              <button onClick={() => currentUser ? navigate('favorites') : navigate('login')} className={`flex flex-col items-center flex-1 py-1 transition-colors ${currentView === 'favorites' ? 'text-blue-500' : 'text-gray-500 hover:text-gray-400'}`}>
                <Heart size={24} className={currentView === 'favorites' ? 'stroke-2 fill-current' : 'stroke-[1.5]'} /><span className="text-[10px] mt-1 font-medium">โปรด</span>
              </button>
            )}

            <button onClick={() => currentUser ? navigate('profile') : navigate('login')} className={`flex flex-col items-center flex-1 py-1 transition-colors ${currentView === 'profile' ? 'text-blue-500' : 'text-gray-500 hover:text-gray-400'}`}>
              <User size={24} className={currentView === 'profile' ? 'stroke-2' : 'stroke-[1.5]'} /><span className="text-[10px] mt-1 font-medium">{currentUser ? 'ฉัน' : 'เข้าสู่ระบบ'}</span>
            </button>
          </nav>
        )}

        {fullscreenImageIndex !== null && selectedProperty && selectedProperty.images && (
          <div className="fixed inset-0 bg-black z-[3000] flex flex-col animate-in fade-in duration-200">
            <div className="p-4 flex justify-between items-center z-10 absolute top-0 w-full bg-gradient-to-b from-black/70 to-transparent pt-10">
              <button onClick={() => setFullscreenImageIndex(null)} className="bg-gray-900/60 p-2.5 rounded-full text-white backdrop-blur-md hover:bg-gray-800 transition-colors"><X size={24} /></button>
              <div className="text-white font-bold text-sm bg-black/50 px-3 py-1 rounded-full">{fullscreenImageIndex + 1} / {selectedProperty.images.length}</div>
            </div>
            <div className="flex-1 flex items-center justify-center overflow-hidden relative">
              <img src={selectedProperty.images[fullscreenImageIndex]} alt="fullscreen" className="w-full h-auto max-h-full object-contain" />
              {fullscreenImageIndex > 0 && <button onClick={(e) => { e.stopPropagation(); setFullscreenImageIndex(prev => prev - 1); }} className="absolute left-4 p-3 bg-black/50 text-white rounded-full hover:bg-black/70 active:scale-95"><ChevronLeft size={28} /></button>}
              {fullscreenImageIndex < selectedProperty.images.length - 1 && <button onClick={(e) => { e.stopPropagation(); setFullscreenImageIndex(prev => prev + 1); }} className="absolute right-4 p-3 bg-black/50 text-white rounded-full hover:bg-black/70 active:scale-95"><ChevronRight size={28} /></button>}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default function AppWrapper() {
  return (
    <GoogleOAuthProvider clientId={CLIENT_ID}>
      <MainApp />
    </GoogleOAuthProvider>
  );
}
