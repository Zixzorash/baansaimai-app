react
import React, { useState, useEffect, useRef } from 'react';
import { MapPin, List, Heart, User, PlusCircle, Search, LogOut, Phone, Mail, Lock, Building, Map as MapIcon, Filter, X, Check, ChevronLeft, MessageCircle, Image as ImageIcon, DownloadCloud, UploadCloud, Trash2, Settings, Loader2, Home, KeyRound } from 'lucide-react';

// --- CUSTOM LOGO COMPONENT ---
const SaimaiLogo = ({ size = "normal" }) => {
  const isLarge = size === "large";
  return (
    <div className={`flex flex-col items-center justify-center ${isLarge ? 'mb-4' : 'mr-2'}`}>
      <Home size={isLarge ? 48 : 24} className="text-blue-500" />
      <span className={`font-extrabold tracking-wider text-blue-400 uppercase ${isLarge ? 'text-lg mt-1' : 'text-[9px] -mt-1'}`}>
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

// --- MOCK DATA ---
const initialProperties = [
  { id: 1, propertyId: 'SM-1001', type: 'rent', propType: 'บ้านเดี่ยว', price: 15000, title: 'บ้านเดี่ยว 2 ชั้น ซอยพหลโยธิน 54/1', lat: 13.921, lng: 100.641, images: ['https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80'], desc: 'บ้านสวยพร้อมอยู่ 3 ห้องนอน 2 ห้องน้ำ' },
  { id: 2, propertyId: 'SM-1002', type: 'sale', propType: 'ทาวน์โฮม', price: 2500000, title: 'ทาวน์โฮม โครงการใหม่ สายไหม 78', lat: 13.915, lng: 100.662, images: ['https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=800&q=80'], desc: 'ทาวน์โฮมสไตล์โมเดิร์น 2 ชั้น ทำเลดี ติดถนนใหญ่' },
];

const PROPERTY_TYPES = ['บ้านเดี่ยว', 'ทาวน์โฮม', 'ทาวน์เฮ้าส์', 'คอนโด', 'อพาร์ทเม้นท์'];
const TRANSACTION_TYPES = [{ id: 'sale', label: 'ขาย' }, { id: 'rent', label: 'ให้เช่า' }];

export default function App() {
  // --- STATES ---
  const [currentUser, setCurrentUser] = useState(null);
  const [currentView, setCurrentView] = useState('map'); // map, list, favorites, admin, profile, login, register, detail, forgot-password
  const [previousView, setPreviousView] = useState('map'); 
  const [selectedProperty, setSelectedProperty] = useState(null); 
  
  const [properties, setProperties] = useState(initialProperties);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  
  // App Script URL State
  const [gasUrl, setGasUrl] = useState(localStorage.getItem('gasUrl') || '');
  
  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState({ types: [], transactionTypes: [], minPrice: '', maxPrice: '' });

  // --- SET TITLE ---
  useEffect(() => { document.title = "บ้านสายไหม - ขายบ้านสายไหม เช่าบ้านสายไหม คอนโดสายไหม"; }, []);

  // --- LOAD LEAFLET ---
  useEffect(() => {
    if (document.getElementById('leaflet-css')) { setLeafletLoaded(true); return; }
    const link = document.createElement('link');
    link.id = 'leaflet-css'; link.rel = 'stylesheet'; link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => setLeafletLoaded(true);
    document.head.appendChild(script);
  }, []);

  // --- HANDLERS ---
  const toggleFavorite = (propertyId) => {
    if (!currentUser) { alert("กรุณาเข้าสู่ระบบเพื่อบันทึกรายการโปรด"); setCurrentView('login'); return; }
    const isFav = currentUser.favorites.includes(propertyId);
    let newFavs = isFav ? currentUser.favorites.filter(id => id !== propertyId) : [...currentUser.favorites, propertyId];
    setCurrentUser({ ...currentUser, favorites: newFavs });
  };

  const handleLogin = (user) => { setCurrentUser(user); setCurrentView('map'); };
  const handleLogout = () => { setCurrentUser(null); setCurrentView('map'); };
  const openDetail = (prop, fromView) => { setSelectedProperty(prop); setPreviousView(fromView); setCurrentView('detail'); };
  const resetFilters = () => { setFilters({ types: [], transactionTypes: [], minPrice: '', maxPrice: '' }); };

  const saveGasUrl = (url) => {
    setGasUrl(url);
    localStorage.setItem('gasUrl', url);
    alert('บันทึก Web App URL เรียบร้อย');
  };

  // --- FILTER PROPERTIES ---
  const filteredProperties = properties.filter(p => {
    const matchSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        p.propType.includes(searchQuery) || 
                        (p.propertyId && p.propertyId.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchType = filters.types.length === 0 || filters.types.includes(p.propType);
    const matchTransaction = filters.transactionTypes.length === 0 || filters.transactionTypes.includes(p.type);
    const minP = filters.minPrice === '' ? 0 : Number(filters.minPrice);
    const maxP = filters.maxPrice === '' ? Infinity : Number(filters.maxPrice);
    const matchPrice = p.price >= minP && p.price <= maxP;
    
    return matchSearch && matchType && matchTransaction && matchPrice;
  });

  // --- REUSABLE COMPONENTS ---
  const SearchBar = () => (
    <div className="flex items-center gap-2 mb-4 w-full px-4 pt-4">
      <div className="flex-1 bg-gray-800 rounded-xl shadow-lg flex items-center px-4 py-3 border border-gray-700">
        <Search size={20} className="text-gray-400" />
        <input 
          type="text" placeholder="ค้นหาทรัพย์สิน, รหัสทรัพย์, ทำเล..." 
          className="ml-3 w-full bg-transparent outline-none text-sm text-gray-200 placeholder-gray-500"
          value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      <button 
        onClick={() => setIsFilterOpen(true)}
        className="bg-gray-800 p-3 rounded-xl shadow-lg border border-gray-700 text-gray-300 relative hover:bg-gray-700 transition-colors"
      >
        <Filter size={22} />
        {(filters.types.length > 0 || filters.transactionTypes.length > 0 || filters.minPrice || filters.maxPrice) && (
          <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-blue-500 rounded-full"></span>
        )}
      </button>
    </div>
  );

  const FilterPanel = () => {
    if (!isFilterOpen) return null;
    return (
      <div className="absolute inset-0 bg-black/60 z-[2000] flex flex-col justify-end">
        <div className="bg-gray-900 rounded-t-3xl p-6 h-[85%] flex flex-col shadow-2xl border-t border-gray-800">
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
                       <input 
                        type="checkbox" className="hidden" checked={isSelected}
                        onChange={() => setFilters(prev => ({...prev, transactionTypes: isSelected ? prev.transactionTypes.filter(t => t !== trans.id) : [...prev.transactionTypes, trans.id]}))}
                      />
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
                      <input 
                        type="checkbox" className="hidden" checked={isSelected}
                        onChange={() => setFilters(prev => ({...prev, types: isSelected ? prev.types.filter(t => t !== type) : [...prev.types, type]}))}
                      />
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
          <div className="pt-4 border-t border-gray-800 mt-4 flex gap-4">
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
      if (!leafletLoaded || !mapRef.current || !window.L) return;
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
            <button id="map-btn-${prop.id}" style="width: 100%; background-color: #2563eb; color: white; border: none; padding: 8px 0; border-radius: 6px; font-weight: bold; cursor: pointer;">แสดงข้อมูล</button>
          </div>
        `;
        const marker = window.L.marker([prop.lat, prop.lng], { icon }).addTo(markersLayer.current)
          .bindPopup(popupContent, { className: 'dark-popup' });
        marker.on('popupopen', () => {
          const btn = document.getElementById(`map-btn-${prop.id}`);
          if (btn) btn.onclick = () => openDetail(prop, 'map');
        });
      });
    }, [leafletLoaded, filteredProperties]);

    return (
      <div className="relative w-full h-full bg-gray-100 flex flex-col">
        <div className="absolute top-0 left-0 right-0 z-[1000] pointer-events-none">
          <div className="pointer-events-auto"><SearchBar /></div>
        </div>
        {!leafletLoaded && <div className="flex items-center justify-center h-full text-gray-600">กำลังโหลดแผนที่...</div>}
        <div ref={mapRef} className="flex-1 w-full z-0" />
      </div>
    );
  };

  // 2. List View Component
  const PropertyList = ({ propertiesToShow, emptyMessage, hideSearch, viewName }) => (
    <div className="flex flex-col h-full bg-gray-900">
      {!hideSearch && <SearchBar />}
      <div className={`px-4 ${hideSearch ? 'pt-4' : 'pt-0'} pb-24 space-y-4 overflow-y-auto flex-1`}>
        {propertiesToShow.length === 0 ? (
          <div className="text-center text-gray-500 py-10 flex flex-col items-center"><Search size={48} className="text-gray-700 mb-3" />{emptyMessage}</div>
        ) : (
          propertiesToShow.map(prop => {
            const isFav = currentUser?.favorites?.includes(prop.id);
            const transType = prop.type === 'rent' ? 'เช่า' : 'ขาย';
            const displayImg = prop.images && prop.images.length > 0 ? prop.images[0] : 'https://via.placeholder.com/400?text=No+Image';
            return (
              <div key={prop.id} onClick={() => openDetail(prop, viewName)} className="bg-gray-800 rounded-2xl shadow-md overflow-hidden border border-gray-700 cursor-pointer active:scale-[0.98]">
                <div className="relative h-48">
                  <img src={displayImg} alt={prop.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 to-transparent"></div>
                  <div className="absolute top-3 left-3 bg-gray-900/80 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-gray-200 border border-gray-600">
                    {transType} - {prop.propType}
                  </div>
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
          })
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

    const handleLineShare = () => {
      const propertyUrl = `https://baansaimai.com/property/${prop.id}`;
      const message = `สวัสดีครับ/ค่ะ สนใจสอบถามข้อมูลเพิ่มเติม รหัสทรัพย์: ${prop.propertyId}\nหัวข้อ: ${prop.title}\nราคา: ${prop.price.toLocaleString()} บาท\nลิงก์: ${propertyUrl}`;
      const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(message)}`;
      window.open(lineUrl, '_blank');
    };

    return (
      <div className="flex flex-col h-full bg-gray-900 overflow-y-auto pb-8 z-50 absolute inset-0 w-full">
        <div className="absolute top-0 w-full p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/70 to-transparent pt-10">
          <button onClick={() => setCurrentView(previousView)} className="bg-gray-900/60 p-2.5 rounded-full text-white backdrop-blur-md border border-gray-600/50"><ChevronLeft size={24} /></button>
          <button onClick={() => toggleFavorite(prop.id)} className="bg-gray-900/60 p-2.5 rounded-full text-white backdrop-blur-md border border-gray-600/50">
            <Heart size={24} className={isFav ? "text-red-500 fill-red-500" : "text-gray-200"} />
          </button>
        </div>

        <div className="w-full aspect-[4/3] relative bg-gray-800 overflow-x-auto flex snap-x snap-mandatory hide-scrollbar">
          {prop.images && prop.images.length > 0 ? (
            prop.images.map((img, idx) => (
              <img key={idx} src={img} alt={`${prop.title}-${idx}`} className="w-full h-full object-cover shrink-0 snap-center" />
            ))
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-500">ไม่มีรูปภาพ</div>
          )}
          {prop.images && prop.images.length > 1 && (
            <div className="absolute bottom-4 right-4 bg-black/60 text-white text-xs px-2 py-1 rounded-full z-10 pointer-events-none backdrop-blur-sm">
              ปัดเพื่อดูรูป 1/{prop.images.length}
            </div>
          )}
        </div>

        <div className="flex-1 p-5 bg-gray-900 -mt-6 rounded-t-3xl relative z-10 border-t border-gray-800">
          <div className="flex justify-between items-start mb-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-gray-800 text-gray-300 text-xs px-3 py-1.5 rounded-lg border border-gray-700 font-bold">{transType} - {prop.propType}</span>
              <span className="bg-gray-800 text-gray-400 text-xs px-2 py-1.5 rounded-lg border border-gray-700 flex items-center gap-1"><MapPin size={12}/> สายไหม</span>
            </div>
            <span className="text-gray-500 text-xs font-mono bg-gray-800 px-2 py-1 rounded border border-gray-700">ID: {prop.propertyId}</span>
          </div>
          
          <h1 className="text-2xl font-bold text-white leading-tight mb-2">{prop.title}</h1>
          <div className={`text-3xl font-extrabold my-2 ${prop.type === 'rent' ? 'text-blue-400' : 'text-red-400'}`}>
            ฿{prop.price.toLocaleString()} {prop.type === 'rent' && <span className="text-base font-normal text-gray-400">/ เดือน</span>}
          </div>
          <hr className="border-gray-800 my-6" />
          <h3 className="text-lg font-bold text-white mb-3">รายละเอียดทรัพย์</h3>
          <p className="text-gray-400 leading-relaxed text-sm whitespace-pre-wrap">{prop.desc}</p>

          <div className="mt-8 flex gap-3">
            <button className="flex-1 bg-gray-800 border border-gray-700 hover:bg-gray-700 text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2"><Phone size={20} className="text-blue-400" /> โทร</button>
            <button onClick={handleLineShare} className="flex-1 bg-[#00B900] hover:bg-[#009900] text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-green-900/20"><MessageCircle size={20} /> LINE</button>
          </div>
        </div>
      </div>
    );
  };

  // 4. Admin View (Integration with Google Apps Script)
  const AdminView = () => {
    const defaultLat = 13.920;
    const defaultLng = 100.650;
    const [formData, setFormData] = useState({
      title: '', propType: 'บ้านเดี่ยว', type: 'rent', price: '', desc: '', lat: defaultLat, lng: defaultLng
    });
    const [newPropId, setNewPropId] = useState('');
    const [imageFiles, setImageFiles] = useState([]); 
    const [imagePreviews, setImagePreviews] = useState([]); 
    const [isUploading, setIsUploading] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [tempGasUrl, setTempGasUrl] = useState(gasUrl);

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
        reader.onload = () => resolve({
          name: file.name,
          mimeType: file.type,
          base64: reader.result.split(',')[1]
        });
        reader.onerror = error => reject(error);
      });
    };

    const handleSubmit = async (e) => {
      e.preventDefault();
      
      if (!gasUrl) { alert('ยังไม่ได้ตั้งค่า Google Sheets URL ระบบจะบันทึกจำลองลงในเครื่องเท่านั้น'); }

      setIsUploading(true);

      try {
        let finalImages = [];
        if (gasUrl) {
          const base64Images = await Promise.all(imageFiles.map(file => convertToBase64(file)));
          const payload = { action: 'addProperty', property: { ...formData, propertyId: newPropId }, images: base64Images };
          const response = await fetch(gasUrl, { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'text/plain;charset=utf-8' } });
          const result = await response.json();
          if (result.status === 'success') { finalImages = result.urls; } else { throw new Error(result.message); }
        } else {
          finalImages = imagePreviews.length > 0 ? imagePreviews : ['https://via.placeholder.com/800?text=No+Image'];
        }

        const newProp = {
          ...formData, id: Date.now(), propertyId: newPropId, price: Number(formData.price), images: finalImages
        };

        setProperties([newProp, ...properties]);
        alert(`บันทึกทรัพย์รหัส ${newPropId} สำเร็จ!`);
        
        setFormData({ title: '', propType: 'บ้านเดี่ยว', type: 'rent', price: '', desc: '', lat: defaultLat, lng: defaultLng });
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
      const headers = ['propertyId', 'type', 'propType', 'price', 'title', 'lat', 'lng', 'desc'];
      const csvRows = [headers.join(',')];
      properties.forEach(p => {
        const safeTitle = `"${p.title.replace(/"/g, '""')}"`;
        const safeDesc = `"${p.desc.replace(/"/g, '""').replace(/\n/g, ' ')}"`;
        const row = [p.propertyId, p.type, p.propType, p.price, safeTitle, p.lat, p.lng, safeDesc];
        csvRows.push(row.join(','));
      });
      const blob = new Blob(["\ufeff" + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `baansaimai_export_${Date.now()}.csv`;
      link.click();
    };

    return (
      <div className="p-4 pb-24 overflow-y-auto h-full bg-gray-900">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">จัดการระบบ (Admin)</h2>
          <button onClick={() => setShowSettings(!showSettings)} className="text-gray-400 hover:text-white p-2 bg-gray-800 rounded-full"><Settings size={20}/></button>
        </div>
        
        {showSettings && (
          <div className="bg-blue-900/20 p-4 rounded-xl shadow-md border border-blue-800 mb-6">
            <h3 className="text-sm font-bold text-blue-400 mb-2">เชื่อมต่อ Google Sheets API</h3>
            <p className="text-xs text-gray-400 mb-3">นำ URL ที่ได้จากการ Deploy Google Apps Script มาวางที่นี่ เพื่อบันทึกรูปภาพลง Google Drive และข้อมูลลง Sheets อัตโนมัติ</p>
            <div className="flex gap-2">
              <input type="text" className="flex-1 bg-gray-800 border border-gray-700 rounded-lg p-2 text-sm text-white" placeholder="https://script.google.com/macros/s/.../exec" value={tempGasUrl} onChange={e=>setTempGasUrl(e.target.value)} />
              <button onClick={() => saveGasUrl(tempGasUrl)} className="bg-blue-600 text-white px-3 rounded-lg text-sm font-bold">บันทึก</button>
            </div>
          </div>
        )}

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

        <div className="bg-gray-800 p-5 rounded-2xl shadow-md border border-gray-700">
          <form onSubmit={handleSubmit} className="space-y-4">
            
            <div className="bg-gray-900 p-3 rounded-lg border border-gray-700 flex justify-between items-center">
              <span className="text-sm font-bold text-gray-400">รหัสทรัพย์ (อัตโนมัติ)</span>
              <span className="text-lg font-mono font-bold text-blue-400">{newPropId}</span>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-400 mb-1">หัวข้อประกาศ</label>
              <input type="text" required className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg p-3 outline-none" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="เช่น ทาวน์โฮม 2 ชั้น สายไหม" />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
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

            <div>
              <label className="block text-sm font-bold text-gray-400 mb-1">ราคา (บาท)</label>
              <input type="number" required className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg p-3 outline-none" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} placeholder="เช่น 15000" />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-400 mb-1">พิกัดบนแผนที่ (คลิกเพื่อปักหมุด)</label>
              <div className="w-full h-40 bg-gray-200 rounded-lg mb-2 relative z-0" ref={adminMapRef}></div>
              <div className="grid grid-cols-2 gap-2">
                <input type="number" step="any" className="w-full bg-gray-900 border border-gray-700 text-gray-300 text-sm rounded p-2" value={formData.lat} onChange={e => setFormData({...formData, lat: parseFloat(e.target.value)})} placeholder="Latitude"/>
                <input type="number" step="any" className="w-full bg-gray-900 border border-gray-700 text-gray-300 text-sm rounded p-2" value={formData.lng} onChange={e => setFormData({...formData, lng: parseFloat(e.target.value)})} placeholder="Longitude"/>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-bold text-gray-400">รูปภาพ ({imageFiles.length}/10)</label>
                <button type="button" onClick={() => fileInputRef.current.click()} className="text-xs bg-blue-600/20 text-blue-400 px-2 py-1 rounded border border-blue-500/30 flex items-center gap-1">
                  <ImageIcon size={14} /> เพิ่มรูป
                </button>
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
              ) : (
                <div className="text-xs text-gray-500 italic p-3 bg-gray-900 rounded border border-gray-700 text-center">ยังไม่ได้อัปโหลดรูปภาพ</div>
              )}
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-400 mb-1">รายละเอียดเพิ่มเติม</label>
              <textarea rows="3" className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg p-3 outline-none" value={formData.desc} onChange={e => setFormData({...formData, desc: e.target.value})} placeholder="รายละเอียดบ้าน, สถานที่ใกล้เคียง"></textarea>
            </div>

            <button type="submit" disabled={isUploading} className="w-full bg-blue-600 text-white rounded-xl py-3 font-bold shadow-lg hover:bg-blue-700 mt-4 disabled:bg-blue-800 disabled:text-gray-400 flex justify-center items-center gap-2">
              {isUploading ? <><Loader2 size={20} className="animate-spin" /> กำลังอัปโหลดข้อมูล...</> : "บันทึกและเผยแพร่ทรัพย์"}
            </button>
          </form>
        </div>
      </div>
    );
  };

  // 5. Login View (Updated with Social Login Mock & Forgot Password)
  const LoginView = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [loginMethod, setLoginMethod] = useState(''); // 'normal', 'line', 'google'

    const onSubmit = (e) => {
      e.preventDefault();
      setIsLoading(true);
      setLoginMethod('normal');
      
      // Simulate network request
      setTimeout(() => {
        if ((username.toLowerCase() === 'admin_bann@sajikacash.in.th' && password === '058767502') || (username === 'admin' && password === 'admin')) {
          handleLogin({ id: 'a1', username: 'ผู้ดูแลระบบ', role: 'admin', favorites: [] });
        } else {
          handleLogin({ id: Date.now().toString(), username: username || 'User', role: 'user', favorites: [] });
        }
        setIsLoading(false);
      }, 800);
    };

    const mockSocialLogin = (provider) => {
      setIsLoading(true);
      setLoginMethod(provider.toLowerCase());
      
      // Simulate OAuth Redirect & Connection
      setTimeout(() => {
        handleLogin({ id: Date.now().toString(), username: `ผู้ใช้จาก ${provider}`, role: 'user', favorites: [] });
        setIsLoading(false);
      }, 1500);
    };

    return (
      <div className="p-6 flex flex-col justify-center h-full bg-gray-900 pb-24">
        <div className="text-center mb-8">
          <SaimaiLogo size="large" />
          <h1 className="text-2xl font-bold text-white mt-4">บ้านสายไหม</h1>
          <p className="text-gray-400 text-sm">เข้าสู่ระบบเพื่อบันทึกบ้านที่คุณสนใจ</p>
        </div>
        
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="relative">
            <User className="absolute top-3 left-3 text-gray-500" size={20} />
            <input type="text" required placeholder="อีเมล / ชื่อผู้ใช้งาน" disabled={isLoading} className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl py-3 pl-10 pr-4 outline-none disabled:opacity-50" value={username} onChange={e => setUsername(e.target.value)} />
          </div>
          <div className="relative">
            <Lock className="absolute top-3 left-3 text-gray-500" size={20} />
            <input type="password" required placeholder="รหัสผ่าน" disabled={isLoading} className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl py-3 pl-10 pr-4 outline-none disabled:opacity-50" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          
          <div className="flex justify-end">
            <button type="button" onClick={() => setCurrentView('forgot-password')} className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
              ลืมรหัสผ่าน?
            </button>
          </div>

          <button type="submit" disabled={isLoading} className="w-full bg-blue-600 text-white rounded-xl py-3 font-bold shadow-lg hover:bg-blue-700 flex justify-center items-center disabled:bg-blue-800">
            {isLoading && loginMethod === 'normal' ? <Loader2 size={20} className="animate-spin mr-2" /> : null}
            เข้าสู่ระบบ
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between">
          <hr className="w-full border-gray-700" />
          <span className="px-3 text-gray-500 text-sm whitespace-nowrap">หรือเข้าสู่ระบบด้วย</span>
          <hr className="w-full border-gray-700" />
        </div>

        <div className="mt-6 space-y-3">
          <button disabled={isLoading} onClick={() => mockSocialLogin('LINE')} className="w-full bg-[#00B900] text-white rounded-xl py-3 font-bold shadow-md flex justify-center items-center hover:bg-[#00A000] disabled:opacity-70 transition-colors">
            {isLoading && loginMethod === 'line' ? (
               <Loader2 size={20} className="animate-spin mr-2" />
            ) : (
              <img src="https://upload.wikimedia.org/wikipedia/commons/4/41/LINE_logo.svg" alt="Line" className="w-6 h-6 mr-2 filter brightness-0 invert" />
            )}
            {isLoading && loginMethod === 'line' ? 'กำลังเชื่อมต่อ LINE...' : 'เข้าสู่ระบบด้วย LINE'}
          </button>
          <button disabled={isLoading} onClick={() => mockSocialLogin('Google')} className="w-full bg-gray-800 border border-gray-700 text-gray-200 rounded-xl py-3 font-bold shadow-md flex justify-center items-center hover:bg-gray-700 disabled:opacity-70 transition-colors">
             {isLoading && loginMethod === 'google' ? (
               <Loader2 size={20} className="animate-spin mr-2" />
            ) : (
              <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google" className="w-5 h-5 mr-2" />
            )}
            {isLoading && loginMethod === 'google' ? 'กำลังเชื่อมต่อ Google...' : 'เข้าสู่ระบบด้วย Google'}
          </button>
        </div>

        <div className="mt-8 text-center text-sm text-gray-400">
          ยังไม่มีบัญชีใช่ไหม? <span onClick={() => setCurrentView('register')} className="text-blue-500 font-bold cursor-pointer hover:underline">ลงทะเบียนเลย</span>
        </div>
      </div>
    );
  };

  // 6. Forgot Password View (NEW)
  const ForgotPasswordView = () => {
    const [resetEmail, setResetEmail] = useState('');
    const [isSending, setIsSending] = useState(false);

    const handleResetPassword = (e) => {
      e.preventDefault();
      setIsSending(true);
      
      // Simulate sending email API
      setTimeout(() => {
        setIsSending(false);
        alert(`ระบบได้ส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปยังอีเมล ${resetEmail} เรียบร้อยแล้ว โปรดตรวจสอบกล่องจดหมายของคุณ`);
        setCurrentView('login');
      }, 1500);
    };

    return (
      <div className="p-6 flex flex-col justify-center h-full bg-gray-900 pb-24">
        <div className="mb-8">
          <button onClick={() => setCurrentView('login')} className="text-gray-400 hover:text-white mb-6 flex items-center transition-colors">
            <ChevronLeft size={20} className="mr-1" /> กลับ
          </button>
          <div className="w-16 h-16 bg-blue-900/30 rounded-2xl flex items-center justify-center mb-6 border border-blue-800">
            <KeyRound size={32} className="text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">ลืมรหัสผ่าน?</h1>
          <p className="text-gray-400 text-sm leading-relaxed">
            กรุณากรอกอีเมลที่ใช้ลงทะเบียนไว้ ระบบจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปให้ทางอีเมลของคุณ
          </p>
        </div>
        
        <form onSubmit={handleResetPassword} className="space-y-6">
          <div className="relative">
            <Mail className="absolute top-3 left-3 text-gray-500" size={20} />
            <input 
              type="email" required placeholder="กรอกอีเมลของคุณ" disabled={isSending}
              className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl py-3 pl-10 pr-4 outline-none focus:border-blue-500 disabled:opacity-50" 
              value={resetEmail} onChange={e => setResetEmail(e.target.value)} 
            />
          </div>
          
          <button type="submit" disabled={isSending} className="w-full bg-blue-600 text-white rounded-xl py-3 font-bold shadow-lg hover:bg-blue-700 flex justify-center items-center disabled:bg-blue-800 transition-colors">
            {isSending ? <Loader2 size={20} className="animate-spin mr-2" /> : null}
            {isSending ? 'กำลังส่งอีเมล...' : 'ส่งลิงก์ตั้งรหัสผ่านใหม่'}
          </button>
        </form>
      </div>
    );
  };

  // 7. Register View
  const RegisterView = () => (
    <div className="p-6 flex flex-col justify-center h-full bg-gray-900 pb-24 overflow-y-auto">
      <div className="mb-6">
        <button onClick={() => setCurrentView('login')} className="text-gray-400 hover:text-white mb-4 flex items-center transition-colors">
          <ChevronLeft size={20} className="mr-1" /> กลับ
        </button>
        <h1 className="text-2xl font-bold text-white">ลงทะเบียนสมาชิก</h1>
        <p className="text-gray-400 text-sm mt-1">กรอกข้อมูลเพื่อสร้างบัญชีผู้ใช้ใหม่</p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); setCurrentView('login'); alert("ลงทะเบียนสำเร็จ กรุณาเข้าสู่ระบบ"); }} className="space-y-4">
        <div className="relative">
          <User className="absolute top-3 left-3 text-gray-500" size={20} />
          <input type="text" required placeholder="ชื่อผู้ใช้งาน" className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl py-3 pl-10 pr-4 outline-none focus:border-blue-500"/>
        </div>
        <div className="relative">
          <Lock className="absolute top-3 left-3 text-gray-500" size={20} />
          <input type="password" required placeholder="รหัสผ่าน" className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl py-3 pl-10 pr-4 outline-none focus:border-blue-500"/>
        </div>
        <div className="relative">
          <Mail className="absolute top-3 left-3 text-gray-500" size={20} />
          <input type="email" required placeholder="อีเมล" className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl py-3 pl-10 pr-4 outline-none focus:border-blue-500"/>
        </div>
        <div className="relative">
          <Phone className="absolute top-3 left-3 text-gray-500" size={20} />
          <input type="tel" required placeholder="เบอร์โทรศัพท์" className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl py-3 pl-10 pr-4 outline-none focus:border-blue-500"/>
        </div>
        <button type="submit" className="w-full bg-blue-600 text-white rounded-xl py-3 font-bold shadow-lg hover:bg-blue-700 mt-2">
          สร้างบัญชี
        </button>
      </form>
    </div>
  );

  // 8. Profile View
  const ProfileView = () => (
    <div className="p-6 pb-24 h-full bg-gray-900">
      <div className="bg-gray-800 rounded-2xl shadow-md p-6 flex flex-col items-center border border-gray-700">
        <div className="w-20 h-20 bg-blue-900/50 rounded-full flex items-center justify-center text-blue-400 mb-4 border border-blue-800"><User size={40} /></div>
        <h2 className="text-xl font-bold text-white">{currentUser.username}</h2>
        <p className="text-sm text-gray-300 bg-gray-700 px-3 py-1 rounded-full mt-2 border border-gray-600">{currentUser.role === 'admin' ? 'Administrator' : 'Member'}</p>
        <button onClick={handleLogout} className="mt-8 w-full flex items-center justify-center bg-red-900/20 text-red-400 border border-red-900/50 py-3 rounded-xl font-bold"><LogOut size={20} className="mr-2" /> ออกจากระบบ</button>
      </div>
    </div>
  );

  // --- RENDER MAIN LAYOUT ---
  return (
    <div className="flex flex-col h-screen w-full max-w-md mx-auto bg-gray-900 relative shadow-2xl overflow-hidden font-sans">
      {currentView !== 'detail' && currentView !== 'login' && currentView !== 'forgot-password' && currentView !== 'register' && (
        <header className="bg-gray-900 pt-10 pb-4 px-4 shadow-sm z-10 flex justify-between items-center relative border-b border-gray-800">
          <div className="flex items-center text-white">
            <SaimaiLogo />
            <h1 className="text-xl font-extrabold tracking-tight">บ้านสายไหม</h1>
          </div>
          {!currentUser && <button onClick={() => setCurrentView('login')} className="text-sm font-bold text-blue-400 bg-blue-900/30 border border-blue-800 px-4 py-1.5 rounded-full">เข้าสู่ระบบ</button>}
        </header>
      )}

      <main className="flex-1 overflow-hidden relative">
        {currentView === 'map' && <MapComponent />}
        {currentView === 'list' && <PropertyList propertiesToShow={filteredProperties} emptyMessage="ไม่พบรายการที่ตรงกับเงื่อนไข" viewName="list" />}
        {currentView === 'favorites' && <PropertyList propertiesToShow={properties.filter(p => currentUser?.favorites?.includes(p.id))} emptyMessage="คุณยังไม่ได้บันทึกรายการโปรดใดๆ" hideSearch={true} viewName="favorites" />}
        {currentView === 'login' && <LoginView />}
        {currentView === 'register' && <RegisterView />}
        {currentView === 'forgot-password' && <ForgotPasswordView />}
        {currentView === 'admin' && currentUser?.role === 'admin' && <AdminView />}
        {currentView === 'profile' && currentUser && <ProfileView />}
        {currentView === 'detail' && <PropertyDetailView />}
      </main>

      {currentView !== 'detail' && currentView !== 'forgot-password' && (
        <nav className="absolute bottom-0 w-full bg-gray-900 border-t border-gray-800 pb-safe pt-2 px-2 flex justify-around items-center z-50 h-16 shadow-[0_-10px_20px_rgba(0,0,0,0.5)] rounded-t-2xl">
          <button onClick={() => setCurrentView('map')} className={`flex flex-col items-center flex-1 py-1 transition-colors ${currentView === 'map' ? 'text-blue-500' : 'text-gray-500 hover:text-gray-400'}`}>
            <MapIcon size={24} className={currentView === 'map' ? 'stroke-2' : 'stroke-[1.5]'} /><span className="text-[10px] mt-1 font-medium">แผนที่</span>
          </button>
          <button onClick={() => setCurrentView('list')} className={`flex flex-col items-center flex-1 py-1 transition-colors ${currentView === 'list' ? 'text-blue-500' : 'text-gray-500 hover:text-gray-400'}`}>
            <List size={24} className={currentView === 'list' ? 'stroke-2' : 'stroke-[1.5]'} /><span className="text-[10px] mt-1 font-medium">รายการ</span>
          </button>

          {currentUser?.role === 'admin' ? (
            <button onClick={() => setCurrentView('admin')} className="flex flex-col items-center justify-center -mt-6">
              <div className="bg-blue-600 rounded-full p-3 shadow-[0_0_15px_rgba(37,99,235,0.5)] border-4 border-gray-900 text-white"><PlusCircle size={28} /></div>
              <span className="text-[10px] mt-1 font-medium text-gray-400">จัดการ</span>
            </button>
          ) : (
            <button onClick={() => currentUser ? setCurrentView('favorites') : setCurrentView('login')} className={`flex flex-col items-center flex-1 py-1 transition-colors ${currentView === 'favorites' ? 'text-blue-500' : 'text-gray-500 hover:text-gray-400'}`}>
              <Heart size={24} className={currentView === 'favorites' ? 'stroke-2 fill-current' : 'stroke-[1.5]'} /><span className="text-[10px] mt-1 font-medium">โปรด</span>
            </button>
          )}

          <button onClick={() => currentUser ? setCurrentView('profile') : setCurrentView('login')} className={`flex flex-col items-center flex-1 py-1 transition-colors ${currentView === 'profile' || currentView === 'login' || currentView === 'register' ? 'text-blue-500' : 'text-gray-500 hover:text-gray-400'}`}>
            <User size={24} className={currentView === 'profile' ? 'stroke-2' : 'stroke-[1.5]'} /><span className="text-[10px] mt-1 font-medium">{currentUser ? 'ฉัน' : 'เข้าสู่ระบบ'}</span>
          </button>
        </nav>
      )}

      <FilterPanel />
    </div>
  );
}

