import React, { useState, useEffect, useRef } from 'react';
import { MapPin, List, Heart, User, PlusCircle, Search, LogOut, Phone, Mail, Lock, Building, Map as MapIcon, Filter, X, Check, ChevronLeft, MessageCircle, Image as ImageIcon, DownloadCloud, UploadCloud, Trash2, Loader2, Home, KeyRound, Calendar, Navigation, ChevronRight } from 'lucide-react';

// --- 1. ตั้งค่า Google Apps Script URL ---
const GAS_URL = "https://script.google.com/macros/s/AKfycbxIRSZw360uv5w2mEd-jqPMAFfvKV54QYEX2EF2FsSLFf4x6UP3hiWFf84m_N-WIrE1/exec";

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

// --- HELPER: แปลง URL Google Drive ให้แสดงผลเป็นรูปภาพได้ ---
const getWorkingImageUrl = (url) => {
  if (!url) return '';
  const idMatch = url.match(/id=([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) {
    return `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w1000`;
  }
  return url;
};

// --- MOCK DATA ---
const initialProperties = [
  { id: 1, propertyId: 'SM-1001', type: 'rent', propType: 'บ้านเดี่ยว', price: 15000, title: 'บ้านเดี่ยว 2 ชั้น ซอยพหลโยธิน 54/1', lat: 13.921, lng: 100.641, images: ['https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80'], desc: 'บ้านสวยพร้อมอยู่ 3 ห้องนอน 2 ห้องน้ำ', date: '2026-06-01' },
  { id: 2, propertyId: 'SM-1002', type: 'sale', propType: 'ทาวน์โฮม', price: 2500000, title: 'ทาวน์โฮม โครงการใหม่ สายไหม 78', lat: 13.915, lng: 100.662, images: ['https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=800&q=80'], desc: 'ทาวน์โฮมสไตล์โมเดิร์น 2 ชั้น ทำเลดี ติดถนนใหญ่', date: '2026-06-01' },
];

const PROPERTY_TYPES = ['บ้านเดี่ยว', 'ทาวน์โฮม', 'ทาวน์เฮ้าส์', 'คอนโด', 'อพาร์ทเม้นท์'];
const TRANSACTION_TYPES = [{ id: 'sale', label: 'ขาย' }, { id: 'rent', label: 'ให้เช่า' }];

export default function App() {
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
  const [fullscreenImageIndex, setFullscreenImageIndex] = useState(null); 
  
  const [properties, setProperties] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState({ types: [], transactionTypes: [], minPrice: '', maxPrice: '' });

  // --- เช็ค LINE Login Callback เมื่อเข้าแอปครั้งแรก ---
  useEffect(() => {
    const processLineLoginCallback = async (code) => {
      setIsLoadingData(true);
      try {
        const redirectUri = window.location.origin + window.location.pathname;
        const response = await fetch(GAS_URL, {
          method: 'POST',
          body: JSON.stringify({ action: 'lineLogin', code, redirectUri }),
          headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });
        
        const textData = await response.text();
        const result = JSON.parse(textData);
        
        if (result.status === 'success') {
          handleLoginSuccess({ 
            id: Date.now().toString(), 
            username: result.user.username, 
            email: result.user.email, 
            role: result.user.role, 
            favorites: result.user.favorites || [] // โหลดรายการโปรดที่เคยบันทึกไว้
          });
        } else {
          alert('ล็อกอินผ่าน LINE ล้มเหลว: ' + result.message);
        }
      } catch (err) {
        alert('เกิดข้อผิดพลาดในการเชื่อมต่อ LINE:\n' + err.message);
      } finally {
        setIsLoadingData(false);
      }
    };

    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code) {
      window.history.replaceState({}, document.title, window.location.pathname);
      processLineLoginCallback(code);
    }
  }, []);

  // --- SET TITLE & FETCH DATA ---
  useEffect(() => { 
    document.title = "บ้านสายไหม - ขายบ้านสายไหม เช่าบ้านสายไหม คอนโดสายไหม"; 
    const fetchProperties = async () => {
      if (!GAS_URL) { setProperties(initialProperties); setIsLoadingData(false); return; }
      try {
        const response = await fetch(`${GAS_URL}?action=getProperties`);
        const textData = await response.text();
        let result;
        try { result = JSON.parse(textData); } catch (e) { throw new Error("Invalid Server Response"); }
        if (result.status === 'success' && result.data && result.data.length > 0) {
          const formattedData = result.data.map(p => ({
            id: p.propertyId, propertyId: p.propertyId, type: p.type, propType: p.propType, price: Number(p.price) || 0,
            title: p.title, lat: Number(p.lat) || 13.920, lng: Number(p.lng) || 100.650, desc: p.desc, date: p.date,
            images: p.images ? p.images.split(',').map(getWorkingImageUrl) : []
          }));
          setProperties(formattedData.reverse());
        } else { setProperties(initialProperties); }
      } catch (error) { setProperties(initialProperties); } finally { 
        if (!window.location.search.includes('code=')) setIsLoadingData(false); 
      }
    };
    fetchProperties();
  }, []);

  // --- LOAD LEAFLET ---
  useEffect(() => {
    if (document.getElementById('leaflet-css')) { setLeafletLoaded(true); return; }
    const link = document.createElement('link'); link.id = 'leaflet-css'; link.rel = 'stylesheet'; link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(link);
    const script = document.createElement('script'); script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; script.onload = () => setLeafletLoaded(true); document.head.appendChild(script);
  }, []);

  // --- HANDLERS ---
  const toggleFavorite = (propertyId) => {
    if (!currentUser) { alert("กรุณาเข้าสู่ระบบเพื่อบันทึกรายการโปรด"); setCurrentView('login'); return; }
    
    const isFav = currentUser.favorites.includes(propertyId);
    let newFavs = isFav ? currentUser.favorites.filter(id => id !== propertyId) : [...currentUser.favorites, propertyId];
    const updatedUser = { ...currentUser, favorites: newFavs };
    
    // 1. อัปเดตที่หน้าจอ
    setCurrentUser(updatedUser);
    localStorage.setItem('baansaimai_user', JSON.stringify(updatedUser)); 

    // 2. ส่งข้อมูลไปเซฟที่หลังบ้าน
    if (GAS_URL && currentUser.username !== 'ผู้ดูแลระบบ') {
      fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'updateFavorites', username: currentUser.username, favorites: newFavs }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }
      }).catch(err => console.error("Sync Favorite Error", err));
    }
  };

  const handleLoginSuccess = (user) => { setCurrentUser(user); localStorage.setItem('baansaimai_user', JSON.stringify(user)); setCurrentView('map'); };
  const handleLogout = () => { setCurrentUser(null); localStorage.removeItem('baansaimai_user'); setCurrentView('map'); };
  const openDetail = (prop, fromView) => { setSelectedProperty(prop); setPreviousView(fromView); setCurrentView('detail'); };
  const resetFilters = () => { setFilters({ types: [], transactionTypes: [], minPrice: '', maxPrice: '' }); };

  // --- FILTER PROPERTIES ---
  const filteredProperties = properties.filter(p => {
    const matchSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) || p.propType.includes(searchQuery) || (p.propertyId && p.propertyId.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchType = filters.types.length === 0 || filters.types.includes(p.propType);
    const matchTransaction = filters.transactionTypes.length === 0 || filters.transactionTypes.includes(p.type);
    const minP = filters.minPrice === '' ? 0 : Number(filters.minPrice);
    const maxP = filters.maxPrice === '' ? Infinity : Number(filters.maxPrice);
    const matchPrice = p.price >= minP && p.price <= maxP;
    return matchSearch && matchType && matchTransaction && matchPrice;
  });

  // --- REUSABLE COMPONENTS ---
  const SearchBar = () => (
    <div className="flex items-center gap-2 mb-4 w-full px-4 pt-4 shrink-0 max-w-6xl mx-auto">
      <div className="flex-1 bg-gray-800 rounded-xl shadow-lg flex items-center px-4 py-3 border border-gray-700">
        <Search size={20} className="text-gray-400" />
        <input type="text" placeholder="ค้นหาทรัพย์สิน, รหัสทรัพย์..." className="ml-3 w-full bg-transparent outline-none text-sm text-gray-200 placeholder-gray-500" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
      </div>
      <button onClick={() => setIsFilterOpen(true)} className="bg-gray-800 p-3 rounded-xl shadow-lg border border-gray-700 text-gray-300 relative hover:bg-gray-700 transition-colors">
        <Filter size={22} />
        {(filters.types.length > 0 || filters.transactionTypes.length > 0 || filters.minPrice || filters.maxPrice) && (<span className="absolute top-2 right-2 w-2.5 h-2.5 bg-blue-500 rounded-full"></span>)}
      </button>
    </div>
  );

  const FilterPanel = () => {
    if (!isFilterOpen) return null;
    return (
      <div className="absolute inset-0 bg-black/60 z-[2000] flex flex-col justify-end items-center">
        <div className="bg-gray-900 rounded-t-3xl p-6 h-[85%] w-full max-w-lg flex flex-col shadow-2xl border-t border-gray-800">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white">ตัวกรองการค้นหา</h2>
            <button onClick={() => setIsFilterOpen(false)} className="bg-gray-800 p-2 rounded-full text-gray-400 hover:text-white"><X size={20} /></button>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-6 pr-2 hide-scrollbar">
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
          <div className="pt-4 border-t border-gray-800 mt-4 flex gap-4 shrink-0">
            <button onClick={resetFilters} className="w-1/3 py-3 rounded-xl font-bold text-gray-300 bg-gray-800 hover:bg-gray-700">ล้างค่า</button>
            <button onClick={() => setIsFilterOpen(false)} className="w-2/3 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700">ดูผลลัพธ์ ({filteredProperties.length})</button>
          </div>
        </div>
      </div>
    );
  };

  // --- MAIN VIEWS ---

  // 1. Map View Component
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
          if (btn) btn.onclick = () => openDetail(prop, 'map');
        });
      });
    }, [leafletLoaded, filteredProperties, isLoadingData]);

    return (
      <div className="relative w-full h-full bg-gray-100 flex flex-col items-center">
        <div className="absolute top-0 left-0 right-0 z-[1000] pointer-events-none w-full">
          <div className="pointer-events-auto w-full"><SearchBar /></div>
        </div>
        {isLoadingData ? (
          <div className="flex flex-col items-center justify-center h-full w-full bg-gray-900/5 backdrop-blur-sm z-50">
             <Loader2 size={40} className="animate-spin text-blue-600 mb-3" />
             <p className="text-gray-600 font-bold">กำลังโหลดแผนที่และข้อมูล...</p>
          </div>
        ) : !leafletLoaded && (
          <div className="flex items-center justify-center h-full w-full text-gray-600">กำลังโหลดเอนจิ้นแผนที่...</div>
        )}
        <div ref={mapRef} className="flex-1 w-full z-0" />
      </div>
    );
  };

  // 2. List View Component (Responsive Grid)
  const PropertyList = ({ propertiesToShow, emptyMessage, hideSearch, viewName }) => (
    <div className="flex flex-col h-full bg-gray-900 w-full items-center">
      {!hideSearch && <div className="w-full max-w-6xl"><SearchBar /></div>}
      <div className="px-4 pb-6 overflow-y-auto flex-1 w-full max-w-6xl mt-4 hide-scrollbar">
        {isLoadingData ? (
           <div className="flex flex-col items-center justify-center py-20 w-full">
             <Loader2 size={40} className="animate-spin text-blue-500 mb-3" />
             <p className="text-gray-400 font-bold">กำลังโหลดข้อมูลทรัพย์...</p>
           </div>
        ) : propertiesToShow.length === 0 ? (
          <div className="text-center text-gray-500 py-10 flex flex-col items-center w-full"><Search size={48} className="text-gray-700 mb-3" />{emptyMessage}</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 w-full">
            {propertiesToShow.map(prop => {
              const isFav = currentUser?.favorites?.includes(prop.id);
              const transType = prop.type === 'rent' ? 'เช่า' : 'ขาย';
              const displayImg = prop.images && prop.images.length > 0 ? prop.images[0] : 'https://via.placeholder.com/400?text=No+Image';
              return (
                <div key={prop.propertyId} onClick={() => openDetail(prop, viewName)} className="bg-gray-800 rounded-2xl shadow-md overflow-hidden border border-gray-700 cursor-pointer active:scale-[0.98] transition-transform hover:shadow-blue-900/20 hover:border-gray-600">
                  <div className="relative h-48 sm:h-56">
                    <img src={displayImg} alt={prop.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-gray-900/90 to-transparent"></div>
                    <div className="absolute top-3 left-3 bg-gray-900/80 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-gray-200 border border-gray-600">
                      {transType} - {prop.propType}
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); toggleFavorite(prop.id); }} className="absolute top-3 right-3 bg-gray-900/80 p-2 rounded-full border border-gray-600 hover:bg-gray-700 transition-colors">
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

  // 3. Property Detail View (Responsive)
  const PropertyDetailView = () => {
    if (!selectedProperty) return null;
    const prop = selectedProperty;
    const isFav = currentUser?.favorites?.includes(prop.id);
    const transType = prop.type === 'rent' ? 'เช่า' : 'ขาย';

    const formatDate = (dateStr) => {
      if(!dateStr) return '';
      try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
      } catch (e) { return dateStr; }
    };

    const handleLineShare = () => {
      const propertyUrl = `https://baansaimai.com/property/${prop.propertyId}`;
      const message = `สวัสดีครับ/ค่ะ สนใจสอบถามข้อมูลเพิ่มเติม รหัสทรัพย์: ${prop.propertyId}\nหัวข้อ: ${prop.title}\nราคา: ${prop.price.toLocaleString()} บาท\nลิงก์: ${propertyUrl}`;
      const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(message)}`;
      window.open(lineUrl, '_blank');
    };

    const handleDirections = () => {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${prop.lat},${prop.lng}`;
      window.open(url, '_blank');
    };

    return (
      <div className="flex flex-col h-full bg-gray-900 overflow-y-auto w-full relative items-center">
        <div className="w-full max-w-4xl flex flex-col relative bg-gray-900 min-h-full pb-6 shadow-2xl">
          
          <div className="absolute top-0 w-full p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/70 to-transparent pt-10 pointer-events-none">
            <button onClick={() => { setCurrentView(previousView); setFullscreenImageIndex(null); }} className="pointer-events-auto bg-gray-900/60 p-2.5 rounded-full text-white backdrop-blur-md border border-gray-600/50 hover:bg-gray-800 transition-colors"><ChevronLeft size={24} /></button>
            <button onClick={() => toggleFavorite(prop.id)} className="pointer-events-auto bg-gray-900/60 p-2.5 rounded-full text-white backdrop-blur-md border border-gray-600/50 hover:bg-gray-800 transition-colors">
              <Heart size={24} className={isFav ? "text-red-500 fill-red-500" : "text-gray-200"} />
            </button>
          </div>

          <div className="w-full aspect-[4/3] sm:aspect-video md:h-[450px] relative bg-gray-800 overflow-x-auto flex snap-x snap-mandatory hide-scrollbar shrink-0">
            {prop.images && prop.images.length > 0 ? (
              prop.images.map((img, idx) => (
                <img 
                  key={idx} src={img} alt={`${prop.title}-${idx}`} onClick={() => setFullscreenImageIndex(idx)}
                  className="w-full h-full object-cover shrink-0 snap-center cursor-pointer" 
                />
              ))
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-500">ไม่มีรูปภาพ</div>
            )}
            {prop.images && prop.images.length > 1 && (
              <div className="absolute bottom-4 right-4 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full z-10 pointer-events-none backdrop-blur-sm">
                ปัดเพื่อดูรูป 1/{prop.images.length}
              </div>
            )}
          </div>

          <div className="flex-1 p-5 bg-gray-900 sm:rounded-t-3xl relative z-10 border-t border-gray-800 sm:-mt-10 mx-0 sm:mx-4 mb-4 shadow-xl">
            <div className="flex justify-between items-start mb-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="bg-gray-800 text-gray-300 text-xs px-3 py-1.5 rounded-lg border border-gray-700 font-bold">{transType} - {prop.propType}</span>
                <span className="bg-gray-800 text-gray-400 text-xs px-2 py-1.5 rounded-lg border border-gray-700 flex items-center gap-1"><MapPin size={12}/> สายไหม</span>
                {prop.date && (<span className="bg-gray-800 text-gray-400 text-xs px-2 py-1.5 rounded-lg border border-gray-700 flex items-center gap-1"><Calendar size={12}/> ลงเมื่อ: {formatDate(prop.date)}</span>)}
              </div>
              <span className="text-gray-500 text-xs font-mono bg-gray-800 px-2 py-1 rounded border border-gray-700 mt-1">ID: {prop.propertyId}</span>
            </div>
            
            <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight mb-2 mt-4">{prop.title}</h1>
            <div className={`text-3xl sm:text-4xl font-extrabold my-2 ${prop.type === 'rent' ? 'text-blue-400' : 'text-red-400'}`}>
              ฿{prop.price.toLocaleString()} {prop.type === 'rent' && <span className="text-base sm:text-lg font-normal text-gray-400">/ เดือน</span>}
            </div>

            <div className="mt-8 grid grid-cols-3 gap-3 mb-2 max-w-lg">
              <button className="flex flex-col items-center justify-center gap-1.5 bg-gray-800 border border-gray-700 hover:bg-gray-700 text-white py-3 rounded-2xl font-bold shadow-sm transition-colors active:scale-95">
                <Phone size={22} className="text-blue-400" />
                <span className="text-xs">โทร</span>
              </button>
              <button onClick={handleLineShare} className="flex flex-col items-center justify-center gap-1.5 bg-[#00B900] hover:bg-[#009900] text-white py-3 rounded-2xl font-bold shadow-lg shadow-green-900/20 transition-colors active:scale-95">
                <MessageCircle size={22} />
                <span className="text-xs">LINE</span>
              </button>
              <button onClick={handleDirections} className="flex flex-col items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-2xl font-bold shadow-lg shadow-blue-900/20 transition-colors active:scale-95">
                <Navigation size={22} />
                <span className="text-xs">เส้นทาง</span>
              </button>
            </div>

            <hr className="border-gray-800 my-6" />
            <h3 className="text-lg font-bold text-white mb-3">รายละเอียดทรัพย์</h3>
            <p className="text-gray-400 leading-relaxed text-sm sm:text-base whitespace-pre-wrap">{prop.desc}</p>
          </div>
        </div>
      </div>
    );
  };

  // 4. Admin View (Responsive)
  const AdminView = () => {
    const defaultLat = 13.920;
    const defaultLng = 100.650;
    const todayStr = new Date().toISOString().split('T')[0];

    const [formData, setFormData] = useState({
      title: '', propType: 'บ้านเดี่ยว', type: 'rent', price: '', desc: '', lat: defaultLat, lng: defaultLng, date: todayStr
    });
    const [newPropId, setNewPropId] = useState('');
    const [imageFiles, setImageFiles] = useState([]); 
    const [imagePreviews, setImagePreviews] = useState([]); 
    const [isUploading, setIsUploading] = useState(false);

    const adminMapRef = useRef(null);
    const adminMapInstance = useRef(null);
    const markerRef = useRef(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
      setNewPropId(generatePropertyId(properties));
      
      if (!leafletLoaded || !adminMapRef.current || !window.L) return;
      if (!adminMapInstance.current) {
        adminMapInstance.current = window.L.map(adminMapRef.current).setView([defaultLat, defaultLng], 13);
        window.L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(adminMapInstance.current);
        
        markerRef.current = window.L.marker([defaultLat, defaultLng], { draggable: true }).addTo(adminMapInstance.current);
        adminMapInstance.current.on('click', (e) => {
          markerRef.current.setLatLng(e.latlng);
          setFormData(prev => ({...prev, lat: e.latlng.lat, lng: e.latlng.lng}));
        });
        markerRef.current.on('dragend', (e) => {
          const pos = e.target.getLatLng();
          setFormData(prev => ({...prev, lat: pos.lat, lng: pos.lng}));
        });
      }
    }, [leafletLoaded]);

    const handleImageChange = (e) => {
      const files = Array.from(e.target.files);
      if (imageFiles.length + files.length > 10) { alert('อัพโหลดรูปภาพได้สูงสุด 10 รูปเท่านั้น'); return; }
      
      setImageFiles([...imageFiles, ...files]);
      setImagePreviews([...imagePreviews, ...files.map(f => URL.createObjectURL(f))]);
    };

    const removeImage = (index) => {
      setImageFiles(imageFiles.filter((_, i) => i !== index));
      setImagePreviews(imagePreviews.filter((_, i) => i !== index));
    };

    const convertToBase64 = (file) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve({ name: file.name, mimeType: file.type, base64: reader.result.split(',')[1] });
        reader.onerror = error => reject(error);
      });
    };

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!GAS_URL) { alert('ยังไม่ได้ใส่ Google Sheets URL ในโค้ด (บรรทัดที่ 4) ระบบจะบันทึกจำลองลงในเครื่องเท่านั้น'); }
      setIsUploading(true);

      try {
        let finalImages = [];
        if (GAS_URL) {
          const base64Images = await Promise.all(imageFiles.map(file => convertToBase64(file)));
          const payload = { action: 'addProperty', property: { ...formData, propertyId: newPropId }, images: base64Images };
          
          const response = await fetch(GAS_URL, { 
            method: 'POST', 
            body: JSON.stringify(payload)
          });
          
          const textData = await response.text();
          let result;
          try { result = JSON.parse(textData); } catch (err) { throw new Error("เซิร์ฟเวอร์ไม่ได้ตอบกลับเป็น JSON (กรุณาเช็คการตั้งค่าสิทธิ์ Deploy ให้เป็น Anyone)"); }

          if (result.status === 'success') { finalImages = result.urls; } else { throw new Error(result.message); }
        } else {
          finalImages = imagePreviews.length > 0 ? imagePreviews : ['https://via.placeholder.com/800?text=No+Image'];
        }

        const newProp = {
          ...formData, id: newPropId, propertyId: newPropId, price: Number(formData.price), images: finalImages.map(getWorkingImageUrl)
        };

        setProperties([newProp, ...properties]);
        alert(`บันทึกทรัพย์รหัส ${newPropId} สำเร็จ!`);
        
        setFormData({ title: '', propType: 'บ้านเดี่ยว', type: 'rent', price: '', desc: '', lat: defaultLat, lng: defaultLng, date: todayStr });
        setImageFiles([]); setImagePreviews([]); setNewPropId(generatePropertyId([newProp, ...properties]));
        if(markerRef.current) markerRef.current.setLatLng([defaultLat, defaultLng]);
        if(adminMapInstance.current) adminMapInstance.current.setView([defaultLat, defaultLng], 13);
        
      } catch (error) {
        console.error("Upload Error:", error);
        alert(`เกิดข้อผิดพลาด: ${error.message}`);
      } finally {
        setIsUploading(false);
      }
    };

    const handleExportCSV = () => {
      const headers = ['propertyId', 'type', 'propType', 'price', 'title', 'lat', 'lng', 'desc', 'date'];
      const csvRows = [headers.join(',')];
      properties.forEach(p => {
        const safeTitle = `"${p.title.replace(/"/g, '""')}"`;
        const safeDesc = `"${p.desc.replace(/"/g, '""').replace(/\n/g, ' ')}"`;
        const row = [p.propertyId, p.type, p.propType, p.price, safeTitle, p.lat, p.lng, safeDesc, p.date];
        csvRows.push(row.join(','));
      });
      const blob = new Blob(["\ufeff" + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `baansaimai_export_${Date.now()}.csv`;
      link.click();
    };

    return (
      <div className="p-4 pb-6 overflow-y-auto h-full bg-gray-900 w-full flex flex-col items-center">
        <div className="w-full max-w-2xl">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-white">จัดการระบบ (Admin)</h2>
          </div>

          <div className="bg-gray-800 p-4 rounded-xl shadow-md border border-gray-700 mb-6">
            <h3 className="text-sm font-bold text-gray-400 mb-3">จัดการข้อมูล</h3>
            <div className="flex gap-2">
              <button onClick={handleExportCSV} className="flex-1 bg-green-700 hover:bg-green-600 text-white text-xs py-2 rounded-lg font-bold flex items-center justify-center gap-1 transition-colors">
                <DownloadCloud size={16}/> ส่งออก CSV
              </button>
              <div className="flex-1 relative">
                <input type="file" accept=".csv" onChange={(e) => alert('ระบบอัปโหลด CSV กำลังพัฒนา')} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                <button className="w-full bg-blue-700 hover:bg-blue-600 text-white text-xs py-2 rounded-lg font-bold flex items-center justify-center gap-1 transition-colors">
                  <UploadCloud size={16}/> นำเข้า CSV
                </button>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 p-5 sm:p-8 rounded-2xl shadow-md border border-gray-700">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="bg-gray-900 p-3 rounded-lg border border-gray-700 flex justify-between items-center">
                <span className="text-sm font-bold text-gray-400">รหัสทรัพย์ (อัตโนมัติ)</span>
                <span className="text-lg font-mono font-bold text-blue-400">{newPropId}</span>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-400 mb-1">หัวข้อประกาศ</label>
                <input type="text" required className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg p-3 outline-none" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="เช่น ทาวน์โฮม 2 ชั้น สายไหม" />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-400 mb-1">รูปแบบ</label>
                  <select className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg p-3 outline-none" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                    <option value="sale">ขาย</option>
                    <option value="rent">ให้เช่า</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-400 mb-1">ประเภททรัพย์</label>
                  <select className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg p-3 outline-none" value={formData.propType} onChange={e => setFormData({...formData, propType: e.target.value})}>
                    {PROPERTY_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-400 mb-1">ราคา (บาท)</label>
                  <input type="number" required className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg p-3 outline-none" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} placeholder="เช่น 15000" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-400 mb-1">วันที่ลงประกาศ</label>
                  <input type="date" required className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg p-3 outline-none" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-400 mb-1">พิกัดบนแผนที่ (คลิกเพื่อปักหมุด)</label>
                <div className="w-full h-48 sm:h-64 bg-gray-200 rounded-lg mb-2 relative z-0" ref={adminMapRef}></div>
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" step="any" className="w-full bg-gray-900 border border-gray-700 text-gray-300 text-sm rounded p-2" value={formData.lat} onChange={e => setFormData({...formData, lat: parseFloat(e.target.value)})} placeholder="Latitude"/>
                  <input type="number" step="any" className="w-full bg-gray-900 border border-gray-700 text-gray-300 text-sm rounded p-2" value={formData.lng} onChange={e => setFormData({...formData, lng: parseFloat(e.target.value)})} placeholder="Longitude"/>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-bold text-gray-400">รูปภาพ ({imageFiles.length}/10)</label>
                  <button type="button" onClick={() => fileInputRef.current.click()} className="text-xs bg-blue-600/20 text-blue-400 px-3 py-1.5 rounded border border-blue-500/30 flex items-center gap-1 hover:bg-blue-600/30 transition-colors">
                    <ImageIcon size={14} /> เพิ่มรูป
                  </button>
                  <input type="file" multiple accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageChange} />
                </div>
                
                {imagePreviews.length > 0 ? (
                  <div className="flex gap-3 overflow-x-auto py-3 snap-x hide-scrollbar">
                    {imagePreviews.map((img, i) => (
                      <div key={i} className="relative shrink-0 snap-start w-28 h-28 rounded-lg overflow-hidden border border-gray-600 shadow-md">
                        <img src={img} className="w-full h-full object-cover" alt="preview" />
                        <button type="button" onClick={() => removeImage(i)} className="absolute top-1 right-1 bg-red-600/90 hover:bg-red-500 text-white p-1.5 rounded-full backdrop-blur-sm transition-colors"><Trash2 size={14}/></button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 italic p-6 bg-gray-900 rounded-lg border border-gray-700 border-dashed text-center">ยังไม่ได้อัปโหลดรูปภาพ</div>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-400 mb-1">รายละเอียดเพิ่มเติม</label>
                <textarea rows="4" className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg p-3 outline-none" value={formData.desc} onChange={e => setFormData({...formData, desc: e.target.value})} placeholder="รายละเอียดบ้าน, สถานที่ใกล้เคียง"></textarea>
              </div>

              <button type="submit" disabled={isUploading} className="w-full bg-blue-600 text-white rounded-xl py-4 font-bold shadow-lg hover:bg-blue-700 mt-6 disabled:bg-blue-800 disabled:text-gray-400 flex justify-center items-center gap-2 text-lg">
                {isUploading ? <><Loader2 size={24} className="animate-spin" /> กำลังอัปโหลดข้อมูล...</> : "บันทึกและเผยแพร่ทรัพย์"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  };

  // 5. Login View (Responsive & LINE Action)
  const LoginView = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [loginMethod, setLoginMethod] = useState('');

    const onSubmit = async (e) => {
      e.preventDefault();
      setIsLoading(true);
      setLoginMethod('normal');
      
      if ((username.toLowerCase() === 'admin_bann@sajikacash.in.th' && password === '058767502') || (username === 'admin' && password === 'admin')) {
        handleLoginSuccess({ id: 'a1', username: 'ผู้ดูแลระบบ', role: 'admin', favorites: [] });
        setIsLoading(false);
        return;
      }

      if (!GAS_URL) { alert("กรุณาตั้งค่า GAS_URL ภายในโค้ดเพื่อใช้งานระบบสมาชิกจริง"); setIsLoading(false); return; }

      try {
        const response = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'login', username, password }) });
        const textData = await response.text();
        let result;
        try { result = JSON.parse(textData); } catch (err) { throw new Error("เซิร์ฟเวอร์ไม่ได้ตอบกลับเป็น JSON (กรุณาเช็คการตั้งค่าสิทธิ์ Deploy ให้เป็น Anyone)"); }
        if (result.status === 'success') {
          handleLoginSuccess({ id: Date.now().toString(), username: result.user.username, email: result.user.email, role: result.user.role, favorites: result.user.favorites || [] });
        } else { alert(result.message || "บัญชีผู้ใช้นี้ยังไม่ได้ลงทะเบียน"); }
      } catch (error) { console.error("Login Error:", error); alert(`เกิดข้อผิดพลาดในการเชื่อมต่อ:\n${error.message}`); }
      setIsLoading(false);
    };

    // --- เชื่อมต่อ LINE API จริง ---
    const loginWithLINE = () => {
      setIsLoading(true);
      setLoginMethod('line');
      
      const redirectUri = encodeURIComponent(window.location.origin + window.location.pathname);
      const LINE_CHANNEL_ID = "2010245466"; 
      
      if(!LINE_CHANNEL_ID){ alert("กรุณาใส่ค่า LINE_CHANNEL_ID ในโค้ด React ก่อนครับ"); setIsLoading(false); return; }

      const lineLoginUrl = `https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${LINE_CHANNEL_ID}&redirect_uri=${redirectUri}&state=baansaimai&scope=profile%20openid%20email`;
      window.location.href = lineLoginUrl; 
    };

    const mockSocialLogin = (provider) => {
      setIsLoading(true); setLoginMethod(provider.toLowerCase());
      setTimeout(() => { handleLoginSuccess({ id: Date.now().toString(), username: `ผู้ใช้จาก ${provider}`, role: 'user', favorites: [] }); setIsLoading(false); }, 1500);
    };

    return (
      <div className="p-6 flex flex-col justify-center items-center h-full bg-gray-900 pb-6 overflow-y-auto w-full">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <SaimaiLogo size="large" />
            <h1 className="text-2xl sm:text-3xl font-bold text-white mt-4">บ้านสายไหม</h1>
            <p className="text-gray-400 text-sm mt-2">เข้าสู่ระบบเพื่อบันทึกบ้านที่คุณสนใจ</p>
          </div>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="relative">
              <User className="absolute top-3.5 left-4 text-gray-500" size={20} />
              <input type="text" required placeholder="อีเมล / ชื่อผู้ใช้งาน" disabled={isLoading} className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl py-3.5 pl-12 pr-4 outline-none disabled:opacity-50 transition-colors focus:border-blue-500" value={username} onChange={e => setUsername(e.target.value)} />
            </div>
            <div className="relative">
              <Lock className="absolute top-3.5 left-4 text-gray-500" size={20} />
              <input type="password" required placeholder="รหัสผ่าน" disabled={isLoading} className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl py-3.5 pl-12 pr-4 outline-none disabled:opacity-50 transition-colors focus:border-blue-500" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            <div className="flex justify-end">
              <button type="button" onClick={() => setCurrentView('forgot-password')} className="text-sm text-blue-400 hover:text-blue-300 transition-colors font-medium">ลืมรหัสผ่าน?</button>
            </div>
            <button type="submit" disabled={isLoading} className="w-full bg-blue-600 text-white rounded-xl py-3.5 font-bold shadow-lg hover:bg-blue-700 flex justify-center items-center disabled:bg-blue-800 transition-all active:scale-[0.98]">
              {isLoading && loginMethod === 'normal' && <Loader2 size={20} className="animate-spin mr-2" />} เข้าสู่ระบบ
            </button>
          </form>

          <div className="mt-8 flex items-center justify-between">
            <hr className="w-full border-gray-700" /><span className="px-4 text-gray-500 text-sm whitespace-nowrap">หรือเข้าสู่ระบบด้วย</span><hr className="w-full border-gray-700" />
          </div>

          <div className="mt-8 space-y-3">
            <button disabled={isLoading} onClick={loginWithLINE} className="w-full bg-[#00B900] text-white rounded-xl py-3.5 font-bold shadow-md flex justify-center items-center hover:bg-[#00A000] disabled:opacity-70 transition-all active:scale-[0.98]">
              {isLoading && loginMethod === 'line' ? <Loader2 size={20} className="animate-spin mr-2" /> : <img src="https://upload.wikimedia.org/wikipedia/commons/4/41/LINE_logo.svg" alt="Line" className="w-6 h-6 mr-2 filter brightness-0 invert" />}
              {isLoading && loginMethod === 'line' ? 'กำลังเชื่อมต่อ LINE...' : 'เข้าสู่ระบบด้วย LINE'}
            </button>
            <button disabled={isLoading} onClick={() => mockSocialLogin('Google')} className="w-full bg-gray-800 border border-gray-700 text-gray-200 rounded-xl py-3.5 font-bold shadow-md flex justify-center items-center hover:bg-gray-700 disabled:opacity-70 transition-all active:scale-[0.98]">
              {isLoading && loginMethod === 'google' ? <Loader2 size={20} className="animate-spin mr-2" /> : <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google" className="w-5 h-5 mr-2" />}
              {isLoading && loginMethod === 'google' ? 'กำลังเชื่อมต่อ Google...' : 'เข้าสู่ระบบด้วย Google'}
            </button>
          </div>

          <div className="mt-10 text-center text-sm text-gray-400">
            ยังไม่มีบัญชีใช่ไหม? <span onClick={() => setCurrentView('register')} className="text-blue-500 font-bold cursor-pointer hover:underline">ลงทะเบียนเลย</span>
          </div>
        </div>
      </div>
    );
  };

  // 6. Forgot Password View (Responsive)
  const ForgotPasswordView = () => {
    const [resetEmail, setResetEmail] = useState('');
    const [isSending, setIsSending] = useState(false);

    const handleResetPassword = (e) => {
      e.preventDefault();
      setIsSending(true);
      setTimeout(() => {
        setIsSending(false);
        alert(`ระบบได้ส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปยังอีเมล ${resetEmail} เรียบร้อยแล้ว`);
        setCurrentView('login');
      }, 1500);
    };

    return (
      <div className="p-6 flex flex-col justify-center items-center h-full bg-gray-900 pb-6 overflow-y-auto w-full">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <button onClick={() => setCurrentView('login')} className="text-gray-400 hover:text-white mb-8 flex items-center transition-colors"><ChevronLeft size={20} className="mr-1" /> กลับ</button>
            <div className="w-16 h-16 bg-blue-900/30 rounded-2xl flex items-center justify-center mb-6 border border-blue-800"><KeyRound size={32} className="text-blue-400" /></div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3">ลืมรหัสผ่าน?</h1>
            <p className="text-gray-400 text-sm leading-relaxed">กรุณากรอกอีเมลที่ใช้ลงทะเบียนไว้ ระบบจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปให้ทางอีเมลของคุณ</p>
          </div>
          <form onSubmit={handleResetPassword} className="space-y-6">
            <div className="relative">
              <Mail className="absolute top-3.5 left-4 text-gray-500" size={20} />
              <input type="email" required placeholder="กรอกอีเมลของคุณ" disabled={isSending} className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl py-3.5 pl-12 pr-4 outline-none focus:border-blue-500 disabled:opacity-50 transition-colors" value={resetEmail} onChange={e => setResetEmail(e.target.value)} />
            </div>
            <button type="submit" disabled={isSending} className="w-full bg-blue-600 text-white rounded-xl py-3.5 font-bold shadow-lg hover:bg-blue-700 flex justify-center items-center disabled:bg-blue-800 transition-all active:scale-[0.98]">
              {isSending ? <Loader2 size={20} className="animate-spin mr-2" /> : null} {isSending ? 'กำลังส่งอีเมล...' : 'ส่งลิงก์ตั้งรหัสผ่านใหม่'}
            </button>
          </form>
        </div>
      </div>
    );
  };

  // 7. Register View (Responsive)
  const RegisterView = () => {
    const [formData, setFormData] = useState({ username: '', password: '', email: '', phone: '' });
    const [isLoading, setIsLoading] = useState(false);

    const onSubmit = async (e) => {
      e.preventDefault();
      setIsLoading(true);
      if (!GAS_URL) { alert("กรุณาตั้งค่า GAS_URL ภายในโค้ดเพื่อใช้งานระบบสมัครสมาชิกจริง"); setIsLoading(false); return; }

      try {
        const response = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'register', user: formData }) });
        const textData = await response.text();
        let result;
        try { result = JSON.parse(textData); } catch (err) { throw new Error("เซิร์ฟเวอร์ไม่ได้ตอบกลับเป็น JSON (กรุณาเช็คการตั้งค่าสิทธิ์ Deploy ให้เป็น Anyone)"); }
        
        if (result.status === 'success') { alert("ลงทะเบียนสำเร็จ กรุณาเข้าสู่ระบบ"); setCurrentView('login'); } 
        else { alert(result.message || "เกิดข้อผิดพลาดในการลงทะเบียน"); }
      } catch (error) { console.error("Register Error:", error); alert(`เกิดข้อผิดพลาดในการเชื่อมต่อ:\n${error.message}`); }
      setIsLoading(false);
    };

    return (
      <div className="p-6 flex flex-col justify-center items-center h-full bg-gray-900 pb-6 overflow-y-auto w-full">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <button onClick={() => setCurrentView('login')} className="text-gray-400 hover:text-white mb-8 flex items-center transition-colors"><ChevronLeft size={20} className="mr-1" /> กลับ</button>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">ลงทะเบียนสมาชิก</h1>
            <p className="text-gray-400 text-sm">กรอกข้อมูลเพื่อสร้างบัญชีผู้ใช้ใหม่</p>
          </div>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="relative"><User className="absolute top-3.5 left-4 text-gray-500" size={20} /><input type="text" required placeholder="ชื่อผู้ใช้งาน" disabled={isLoading} className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl py-3.5 pl-12 pr-4 outline-none disabled:opacity-50 transition-colors focus:border-blue-500" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})}/></div>
            <div className="relative"><Lock className="absolute top-3.5 left-4 text-gray-500" size={20} /><input type="password" required placeholder="รหัสผ่าน" disabled={isLoading} className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl py-3.5 pl-12 pr-4 outline-none disabled:opacity-50 transition-colors focus:border-blue-500" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})}/></div>
            <div className="relative"><Mail className="absolute top-3.5 left-4 text-gray-500" size={20} /><input type="email" required placeholder="อีเมล" disabled={isLoading} className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl py-3.5 pl-12 pr-4 outline-none disabled:opacity-50 transition-colors focus:border-blue-500" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})}/></div>
            <div className="relative"><Phone className="absolute top-3.5 left-4 text-gray-500" size={20} /><input type="tel" required placeholder="เบอร์โทรศัพท์" disabled={isLoading} className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl py-3.5 pl-12 pr-4 outline-none disabled:opacity-50 transition-colors focus:border-blue-500" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})}/></div>
            <button type="submit" disabled={isLoading} className="w-full bg-blue-600 text-white rounded-xl py-3.5 font-bold shadow-lg hover:bg-blue-700 mt-4 flex justify-center items-center disabled:bg-blue-800 transition-all active:scale-[0.98]">
              {isLoading ? <Loader2 size={20} className="animate-spin mr-2" /> : null} สร้างบัญชี
            </button>
          </form>
        </div>
      </div>
    );
  };

  // 8. Profile View (Responsive & Added Policy Buttons)
  const ProfileView = () => (
    <div className="p-6 pb-6 h-full bg-gray-900 overflow-y-auto w-full flex flex-col items-center">
      <div className="bg-gray-800 rounded-2xl shadow-xl p-8 flex flex-col items-center border border-gray-700 w-full max-w-sm">
        <div className="w-24 h-24 bg-blue-900/40 rounded-full flex items-center justify-center text-blue-400 mb-4 border-2 border-blue-800/50 shadow-inner">
          <User size={48} />
        </div>
        <h2 className="text-2xl font-bold text-white mb-1">{currentUser?.username}</h2>
        <p className="text-sm font-medium text-gray-300 bg-gray-700/50 px-4 py-1.5 rounded-full mt-2 border border-gray-600/50">
          {currentUser?.role === 'admin' ? 'Administrator' : 'Member'}
        </p>
        
        {/* Buttons for Privacy & Terms */}
        <div className="w-full space-y-3 mt-10">
          <button onClick={() => setCurrentView('privacy')} className="w-full flex items-center justify-between bg-gray-900 text-gray-300 hover:text-white border border-gray-700 hover:border-gray-500 px-4 py-3.5 rounded-xl font-medium transition-colors">
            <div className="flex items-center gap-3"><ShieldCheck size={20} className="text-blue-400" /> นโยบายความเป็นส่วนตัว</div>
            <ChevronRight size={18} className="text-gray-500"/>
          </button>
          <button onClick={() => setCurrentView('terms')} className="w-full flex items-center justify-between bg-gray-900 text-gray-300 hover:text-white border border-gray-700 hover:border-gray-500 px-4 py-3.5 rounded-xl font-medium transition-colors">
            <div className="flex items-center gap-3"><FileText size={20} className="text-blue-400" /> ข้อตกลงการใช้งาน</div>
            <ChevronRight size={18} className="text-gray-500"/>
          </button>
        </div>

        <button onClick={handleLogout} className="mt-8 w-full flex items-center justify-center bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/50 py-3.5 rounded-xl font-bold transition-all active:scale-[0.98]">
          <LogOut size={20} className="mr-2" /> ออกจากระบบ
        </button>
      </div>
    </div>
  );

  // 9. Privacy Policy View
  const PrivacyPolicyView = () => (
    <div className="flex flex-col h-full bg-gray-900 overflow-y-auto w-full items-center">
      <div className="w-full max-w-3xl p-6 pb-10">
        <button onClick={() => setCurrentView('profile')} className="text-gray-400 hover:text-white mb-6 flex items-center transition-colors"><ChevronLeft size={20} className="mr-1" /> กลับไปหน้าโปรไฟล์</button>
        <div className="bg-gray-800 rounded-2xl p-6 sm:p-10 border border-gray-700 shadow-xl">
          <div className="flex items-center gap-3 mb-6 pb-6 border-b border-gray-700">
            <ShieldCheck size={32} className="text-blue-400" />
            <h1 className="text-2xl sm:text-3xl font-bold text-white">นโยบายความเป็นส่วนตัว</h1>
          </div>
          <div className="space-y-6 text-gray-300 text-sm sm:text-base leading-relaxed">
            <p>แพลตฟอร์ม "บ้านสายไหม" (ต่อไปนี้เรียกว่า “เรา”) ตระหนักถึงความสำคัญของข้อมูลส่วนบุคคลของท่าน เราจึงจัดทำนโยบายความเป็นส่วนตัวฉบับนี้ขึ้น เพื่อชี้แจงให้ท่านทราบถึงวิธีการเก็บรวบรวม ใช้ และเปิดเผยข้อมูลส่วนบุคคลของท่าน</p>
            
            <h3 className="text-lg font-bold text-white mt-8 mb-2">1. ข้อมูลส่วนบุคคลที่เราเก็บรวบรวม</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>ข้อมูลบัญชีผู้ใช้:</strong> ชื่อผู้ใช้งาน (Username), อีเมล (Email), รหัสผ่าน (Password) และเบอร์โทรศัพท์</li>
              <li><strong>ข้อมูลจากการเข้าสู่ระบบผ่านโซเชียลมีเดีย:</strong> หากท่านเข้าสู่ระบบผ่านบัญชี LINE หรือ Google เราจะเก็บข้อมูลพื้นฐานที่ได้รับอนุญาตจากผู้ให้บริการนั้นๆ เช่น รหัสบัญชีผู้ใช้ (User ID), ชื่อที่แสดง (Display Name) และอีเมล</li>
              <li><strong>ข้อมูลการใช้งาน:</strong> ข้อมูลรายการทรัพย์สินที่ท่านกดบันทึกเป็น "รายการโปรด" และประวัติการเข้าใช้งานแอปพลิเคชัน</li>
            </ul>

            <h3 className="text-lg font-bold text-white mt-8 mb-2">2. วัตถุประสงค์ในการเก็บรวบรวมข้อมูล</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li>เพื่อสร้างและยืนยันตัวตนบัญชีผู้ใช้งานของท่าน</li>
              <li>เพื่ออำนวยความสะดวกในการใช้งาน เช่น การบันทึกรายการบ้านที่ท่านสนใจ (รายการโปรด)</li>
              <li>เพื่อใช้เป็นช่องทางในการติดต่อสื่อสาร ตอบข้อซักถาม หรือแจ้งข้อมูลที่สำคัญ</li>
              <li>เพื่อปรับปรุงและพัฒนาแพลตฟอร์มให้มีประสิทธิภาพการใช้งานที่ดียิ่งขึ้น</li>
            </ul>

            <h3 className="text-lg font-bold text-white mt-8 mb-2">3. การจัดเก็บและรักษาความปลอดภัยของข้อมูล</h3>
            <p>ข้อมูลของท่านจะถูกจัดเก็บไว้ในระบบฐานข้อมูลที่มีความปลอดภัย (เช่น Google Workspace / Google Sheets) โดยมีการจำกัดสิทธิ์การเข้าถึงข้อมูลเฉพาะผู้ดูแลระบบ (Admin) ที่ได้รับอนุญาตเท่านั้น และเราใช้เทคโนโลยี Local Storage ในการบันทึกสถานะการเข้าสู่ระบบบนอุปกรณ์ของท่านเพื่อความสะดวกในการใช้งาน</p>

            <h3 className="text-lg font-bold text-white mt-8 mb-2">4. การเปิดเผยข้อมูลให้บุคคลที่สาม</h3>
            <p>เรา <strong>ไม่มีนโยบายจำหน่าย หรือเปิดเผยข้อมูลส่วนบุคคลของท่านให้กับบุคคลที่สาม</strong> เว้นแต่จะได้รับความยินยอมจากท่าน หรือเป็นการปฏิบัติตามกฎหมาย คำสั่งศาล หรือหน่วยงานของรัฐที่มีอำนาจ</p>

            <h3 className="text-lg font-bold text-white mt-8 mb-2">5. สิทธิของเจ้าของข้อมูล</h3>
            <p>ท่านมีสิทธิในการขอเข้าถึง ขอแก้ไขข้อมูลให้ถูกต้อง หรือขอลบข้อมูลส่วนบุคคลของท่านออกจากระบบของเราได้ตลอดเวลา โดยสามารถติดต่อผู้ดูแลระบบผ่านช่องทางที่กำหนด</p>

            <h3 className="text-lg font-bold text-white mt-8 mb-2">6. การติดต่อเรา</h3>
            <p>หากท่านมีข้อสงสัยเกี่ยวกับนโยบายความเป็นส่วนตัวฉบับนี้ สามารถติดต่อผู้ดูแลระบบได้ที่:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>LINE Official:</strong> @614rppiz</li>
              <li><strong>อีเมล:</strong> Admin_Bann@sajikacash.in.th</li>
            </ul>
            <p className="text-xs text-gray-500 mt-8 pt-6 border-t border-gray-700">(อัปเดตล่าสุด: มิถุนายน 2569)</p>
          </div>
        </div>
      </div>
    </div>
  );

  // 10. Terms of Use View
  const TermsOfUseView = () => (
    <div className="flex flex-col h-full bg-gray-900 overflow-y-auto w-full items-center">
      <div className="w-full max-w-3xl p-6 pb-10">
        <button onClick={() => setCurrentView('profile')} className="text-gray-400 hover:text-white mb-6 flex items-center transition-colors"><ChevronLeft size={20} className="mr-1" /> กลับไปหน้าโปรไฟล์</button>
        <div className="bg-gray-800 rounded-2xl p-6 sm:p-10 border border-gray-700 shadow-xl">
          <div className="flex items-center gap-3 mb-6 pb-6 border-b border-gray-700">
            <FileText size={32} className="text-blue-400" />
            <h1 className="text-2xl sm:text-3xl font-bold text-white">ข้อตกลงและเงื่อนไขการใช้งาน</h1>
          </div>
          <div className="space-y-6 text-gray-300 text-sm sm:text-base leading-relaxed">
            <p>ยินดีต้อนรับสู่แพลตฟอร์ม "บ้านสายไหม" การที่ท่านเข้าถึงและใช้งานแอปพลิเคชันนี้ ถือว่าท่านได้อ่าน ทำความเข้าใจ และยอมรับที่จะผูกพันตามข้อตกลงและเงื่อนไขดังต่อไปนี้:</p>
            
            <h3 className="text-lg font-bold text-white mt-8 mb-2">1. บริการของเรา</h3>
            <p>"บ้านสายไหม" เป็นแพลตฟอร์มสื่อกลางในการนำเสนอข้อมูลอสังหาริมทรัพย์ (ขาย/ให้เช่า) ในย่านสายไหมและพื้นที่ใกล้เคียง โดยผู้ดูแลระบบ (Admin) เป็นผู้จัดทำและลงประกาศข้อมูลทรัพย์สินต่างๆ</p>

            <h3 className="text-lg font-bold text-white mt-8 mb-2">2. บัญชีผู้ใช้งาน</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li>ท่านต้องให้ข้อมูลที่เป็นความจริงและเป็นปัจจุบันในการสมัครสมาชิก</li>
              <li>ท่านต้องรักษารหัสผ่านและข้อมูลบัญชีของท่านไว้เป็นความลับ หากมีการเข้าสู่ระบบด้วยบัญชีของท่าน จะถือว่าการกระทำนั้นเกิดจากตัวท่านเอง</li>
              <li>เราขอสงวนสิทธิ์ในการระงับหรือยกเลิกบัญชีผู้ใช้งาน หากพบว่ามีการกระทำที่ผิดเงื่อนไข ฝ่าฝืนกฎหมาย หรือก่อให้เกิดความเสียหายต่อแพลตฟอร์ม</li>
            </ul>

            <h3 className="text-lg font-bold text-white mt-8 mb-2">3. การใช้งานที่ได้รับอนุญาต</h3>
            <p>ท่านตกลงที่จะใช้งานแพลตฟอร์มนี้เพื่อวัตถุประสงค์ในการค้นหาที่อยู่อาศัยเพื่อการส่วนตัวเท่านั้น ห้ามมิให้ท่าน:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>คัดลอก ดัดแปลง หรือนำข้อมูล/รูปภาพในแพลตฟอร์มไปใช้เพื่อการค้าโดยไม่ได้รับอนุญาต</li>
              <li>พยายามเจาะระบบ (Hack) นำเข้าไวรัส หรือแทรกแซงการทำงานของแอปพลิเคชัน</li>
            </ul>

            <h3 className="text-lg font-bold text-white mt-8 mb-2">4. ข้อจำกัดความรับผิด (Limitation of Liability)</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>ความถูกต้องของข้อมูล:</strong> แม้เราจะพยายามอย่างเต็มที่ในการตรวจสอบข้อมูล แต่เราไม่รับประกันความถูกต้อง ความสมบูรณ์ หรือความเป็นปัจจุบันของประกาศทรัพย์สิน (เช่น ราคา หรือสถานะการขาย/เช่า อาจมีการเปลี่ยนแปลงโดยไม่ได้แจ้งให้ทราบล่วงหน้า)</li>
              <li><strong>การทำธุรกรรม:</strong> "บ้านสายไหม" เป็นเพียงสื่อกลางในการแสดงข้อมูลเท่านั้น เราไม่มีส่วนรับผิดชอบต่อข้อพิพาท ความเสียหาย หรือการทำธุรกรรมใดๆ ที่เกิดขึ้นระหว่างท่านกับเจ้าของทรัพย์สิน</li>
            </ul>

            <h3 className="text-lg font-bold text-white mt-8 mb-2">5. ลิขสิทธิ์และทรัพย์สินทางปัญญา</h3>
            <p>รูปแบบการนำเสนอ โลโก้ โค้ดคอมพิวเตอร์ และรูปภาพต่างๆ ที่เราจัดทำขึ้น ถือเป็นทรัพย์สินทางปัญญาของแพลตฟอร์ม "บ้านสายไหม" ห้ามมิให้ผู้ใดละเมิดลิขสิทธิ์</p>

            <h3 className="text-lg font-bold text-white mt-8 mb-2">6. การแก้ไขเปลี่ยนแปลงข้อตกลง</h3>
            <p>เราขอสงวนสิทธิ์ในการแก้ไขหรือเปลี่ยนแปลงข้อตกลงและเงื่อนไขการใช้งานนี้ได้ตลอดเวลา โดยการใช้งานแพลตฟอร์มอย่างต่อเนื่องของท่านหลังจากการเปลี่ยนแปลง ถือเป็นการยอมรับข้อตกลงฉบับใหม่</p>

            <h3 className="text-lg font-bold text-white mt-8 mb-2">7. การติดต่อสื่อสาร</h3>
            <p>หากท่านมีข้อเสนอแนะ หรือพบปัญหาการใช้งาน สามารถติดต่อเราได้ที่:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>LINE Official:</strong> @614rppiz</li>
              <li><strong>อีเมล:</strong> Admin_Bann@sajikacash.in.th</li>
            </ul>
            <p className="text-xs text-gray-500 mt-8 pt-6 border-t border-gray-700">(อัปเดตล่าสุด: มิถุนายน 2569)</p>
          </div>
        </div>
      </div>
    </div>
  );

  // --- RENDER MAIN LAYOUT ---
  return (
    <div className="flex flex-col h-[100dvh] w-full bg-gray-900 relative shadow-2xl overflow-hidden font-sans">
      
      {/* Header - Responsive Full Width */}
      {currentView !== 'detail' && currentView !== 'login' && currentView !== 'forgot-password' && currentView !== 'register' && currentView !== 'privacy' && currentView !== 'terms' && (
        <header className="bg-gray-900 pt-safe shadow-sm z-10 border-b border-gray-800 shrink-0 w-full">
          <div className="w-full max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
            <div className="flex items-center text-white shrink-0 min-w-0">
              <SaimaiLogo />
              <h1 className="text-lg sm:text-2xl font-extrabold tracking-tight truncate ml-1">บ้านสายไหม</h1>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4 shrink-0">
              <a href="https://line.me/R/ti/p/@614rppiz" target="_blank" rel="noopener noreferrer" className="text-[10px] sm:text-sm font-bold text-[#00B900] bg-[#00B900]/10 border border-[#00B900]/50 px-3 sm:px-4 py-2 rounded-full hover:bg-[#00B900]/20 flex items-center gap-1.5 transition-colors whitespace-nowrap">
                <MessageCircle size={16} /> ติดต่อลงโพสต์
              </a>
              {!currentUser && currentView !== 'login' && (
                <button onClick={() => setCurrentView('login')} className="text-[10px] sm:text-xs font-bold text-blue-400 bg-blue-900/30 border border-blue-800 px-3 sm:px-4 py-2 rounded-full hover:bg-blue-900/50 whitespace-nowrap transition-colors">
                  เข้าสู่ระบบ
                </button>
              )}
            </div>
          </div>
        </header>
      )}

      {/* Main Content Area - Full width but inner content constrained where needed */}
      <main className="flex-1 overflow-hidden relative flex flex-col w-full">
        {currentView === 'map' && <MapComponent />}
        {currentView === 'list' && <PropertyList propertiesToShow={filteredProperties} emptyMessage="ไม่พบรายการที่ตรงกับเงื่อนไข" viewName="list" />}
        {currentView === 'favorites' && <PropertyList propertiesToShow={properties.filter(p => currentUser?.favorites?.includes(p.id))} emptyMessage="คุณยังไม่ได้บันทึกรายการโปรดใดๆ" hideSearch={true} viewName="favorites" />}
        {currentView === 'login' && <LoginView />}
        {currentView === 'register' && <RegisterView />}
        {currentView === 'forgot-password' && <ForgotPasswordView />}
        {currentView === 'admin' && currentUser?.role === 'admin' && <AdminView />}
        {currentView === 'profile' && currentUser && <ProfileView />}
        {currentView === 'detail' && <PropertyDetailView />}
        {currentView === 'privacy' && <PrivacyPolicyView />}
        {currentView === 'terms' && <TermsOfUseView />}
      </main>

      {/* Bottom Navigation - Fixed Height, centered items on desktop */}
      {currentView !== 'detail' && currentView !== 'forgot-password' && currentView !== 'privacy' && currentView !== 'terms' && (
        <nav className="w-full bg-gray-900 border-t border-gray-800 pb-safe z-50 shrink-0 shadow-[0_-10px_20px_rgba(0,0,0,0.5)]">
          <div className="w-full max-w-md mx-auto h-[72px] flex justify-around items-center px-2 pt-1">
            <button onClick={() => setCurrentView('map')} className={`flex flex-col items-center flex-1 py-1 transition-colors ${currentView === 'map' ? 'text-blue-500' : 'text-gray-500 hover:text-gray-400'}`}>
              <MapIcon size={24} className={currentView === 'map' ? 'stroke-2' : 'stroke-[1.5]'} /><span className="text-[10px] sm:text-xs mt-1 font-medium">แผนที่</span>
            </button>
            <button onClick={() => setCurrentView('list')} className={`flex flex-col items-center flex-1 py-1 transition-colors ${currentView === 'list' ? 'text-blue-500' : 'text-gray-500 hover:text-gray-400'}`}>
              <List size={24} className={currentView === 'list' ? 'stroke-2' : 'stroke-[1.5]'} /><span className="text-[10px] sm:text-xs mt-1 font-medium">รายการ</span>
            </button>

            {currentUser?.role === 'admin' ? (
              <button onClick={() => setCurrentView('admin')} className="flex flex-col items-center justify-center -mt-6">
                <div className="bg-blue-600 rounded-full p-3 shadow-[0_0_15px_rgba(37,99,235,0.5)] border-4 border-gray-900 text-white"><PlusCircle size={28} /></div>
                <span className="text-[10px] sm:text-xs mt-1 font-medium text-gray-400">จัดการ</span>
              </button>
            ) : (
              <button onClick={() => currentUser ? setCurrentView('favorites') : setCurrentView('login')} className={`flex flex-col items-center flex-1 py-1 transition-colors ${currentView === 'favorites' ? 'text-blue-500' : 'text-gray-500 hover:text-gray-400'}`}>
                <Heart size={24} className={currentView === 'favorites' ? 'stroke-2 fill-current' : 'stroke-[1.5]'} /><span className="text-[10px] sm:text-xs mt-1 font-medium">โปรด</span>
              </button>
            )}

            <button onClick={() => currentUser ? setCurrentView('profile') : setCurrentView('login')} className={`flex flex-col items-center flex-1 py-1 transition-colors ${currentView === 'profile' || currentView === 'login' || currentView === 'register' ? 'text-blue-500' : 'text-gray-500 hover:text-gray-400'}`}>
              <User size={24} className={currentView === 'profile' ? 'stroke-2' : 'stroke-[1.5]'} /><span className="text-[10px] sm:text-xs mt-1 font-medium">{currentUser ? 'ฉัน' : 'เข้าสู่ระบบ'}</span>
            </button>
          </div>
        </nav>
      )}

      {/* Overlays */}
      <FilterPanel />

      {/* Fullscreen Image Overlay */}
      {fullscreenImageIndex !== null && selectedProperty && selectedProperty.images && (
        <div className="fixed inset-0 bg-black z-[3000] flex flex-col">
          <div className="p-4 flex justify-between items-center z-10 absolute top-0 w-full bg-gradient-to-b from-black/70 to-transparent pt-10">
            <button onClick={() => setFullscreenImageIndex(null)} className="bg-gray-900/60 p-2.5 rounded-full text-white backdrop-blur-md border border-gray-600/50 hover:bg-gray-800 transition-colors">
              <X size={24} />
            </button>
            <div className="text-white font-bold text-sm bg-black/50 px-3 py-1 rounded-full">
              {fullscreenImageIndex + 1} / {selectedProperty.images.length}
            </div>
          </div>
          
          <div className="flex-1 flex items-center justify-center overflow-hidden relative">
            <img 
              src={selectedProperty.images[fullscreenImageIndex]} 
              alt="fullscreen" 
              className="w-full h-auto max-h-full object-contain" 
            />
            
            {fullscreenImageIndex > 0 && (
              <button 
                onClick={(e) => { e.stopPropagation(); setFullscreenImageIndex(prev => prev - 1); }} 
                className="absolute left-4 p-3 bg-black/50 text-white rounded-full hover:bg-black/70 active:scale-95 transition-all"
              >
                 <ChevronLeft size={28} />
              </button>
            )}
            
            {fullscreenImageIndex < selectedProperty.images.length - 1 && (
              <button 
                onClick={(e) => { e.stopPropagation(); setFullscreenImageIndex(prev => prev + 1); }} 
                className="absolute right-4 p-3 bg-black/50 text-white rounded-full hover:bg-black/70 active:scale-95 transition-all"
              >
                 <ChevronRight size={28} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
