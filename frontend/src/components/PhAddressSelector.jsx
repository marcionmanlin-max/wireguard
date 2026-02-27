import { useState, useEffect, useCallback } from 'react';
import { MapPin, ChevronDown } from 'lucide-react';

const ADDRESS_BASE = '/dns/address';

/**
 * Philippine Address Cascading Selector
 * Region → Province → City/Municipality → Barangay
 * Data from PSGC JSON files (Philippine Standard Geographic Code)
 */
export default function PhAddressSelector({ onChange, className = '' }) {
  const [regions, setRegions] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [cities, setCities] = useState([]);
  const [barangays, setBarangays] = useState([]);

  const [regionCode, setRegionCode] = useState('');
  const [provinceCode, setProvinceCode] = useState('');
  const [cityCode, setCityCode] = useState('');
  const [barangayCode, setBarangayCode] = useState('');

  const [loadingProv, setLoadingProv] = useState(false);
  const [loadingCity, setLoadingCity] = useState(false);
  const [loadingBrgy, setLoadingBrgy] = useState(false);

  // Cache fetched data
  const [cache, setCache] = useState({});

  const fetchJson = useCallback(async (file) => {
    if (cache[file]) return cache[file];
    try {
      const res = await fetch(`${ADDRESS_BASE}/${file}`);
      const data = await res.json();
      setCache(prev => ({ ...prev, [file]: data }));
      return data;
    } catch (err) {
      console.error(`Failed to load ${file}:`, err);
      return [];
    }
  }, [cache]);

  // Load regions on mount
  useEffect(() => {
    fetchJson('region.json').then(data => {
      const sorted = [...data].sort((a, b) => a.region_name.localeCompare(b.region_name));
      setRegions(sorted);
    });
  }, []);

  // Region change → load provinces
  const handleRegionChange = async (code) => {
    setRegionCode(code);
    setProvinceCode('');
    setCityCode('');
    setBarangayCode('');
    setProvinces([]);
    setCities([]);
    setBarangays([]);

    if (!code) { emitChange('', '', '', '', '', '', '', ''); return; }

    setLoadingProv(true);
    const data = await fetchJson('province.json');
    const filtered = data.filter(p => p.region_code === code)
      .sort((a, b) => a.province_name.localeCompare(b.province_name));
    setProvinces(filtered);
    setLoadingProv(false);

    const regionName = regions.find(r => r.region_code === code)?.region_name || '';
    emitChange(regionName, '', '', '', code, '', '', '');
  };

  // Province change → load cities
  const handleProvinceChange = async (code) => {
    setProvinceCode(code);
    setCityCode('');
    setBarangayCode('');
    setCities([]);
    setBarangays([]);

    if (!code) return;

    setLoadingCity(true);
    const data = await fetchJson('city.json');
    const filtered = data.filter(c => c.province_code === code)
      .sort((a, b) => a.city_name.localeCompare(b.city_name));
    setCities(filtered);
    setLoadingCity(false);

    const regionName = regions.find(r => r.region_code === regionCode)?.region_name || '';
    const provinceName = provinces.find(p => p.province_code === code)?.province_name || '';
    emitChange(regionName, provinceName, '', '', regionCode, code, '', '');
  };

  // City change → load barangays
  const handleCityChange = async (code) => {
    setCityCode(code);
    setBarangayCode('');
    setBarangays([]);

    if (!code) return;

    setLoadingBrgy(true);
    const data = await fetchJson('barangay.json');
    const filtered = data.filter(b => b.city_code === code)
      .sort((a, b) => a.brgy_name.localeCompare(b.brgy_name));
    setBarangays(filtered);
    setLoadingBrgy(false);

    const regionName = regions.find(r => r.region_code === regionCode)?.region_name || '';
    const provinceName = provinces.find(p => p.province_code === provinceCode)?.province_name || '';
    const cityName = cities.find(c => c.city_code === code)?.city_name || '';
    emitChange(regionName, provinceName, cityName, '', regionCode, provinceCode, code, '');
  };

  // Barangay change
  const handleBarangayChange = (code) => {
    setBarangayCode(code);
    const regionName = regions.find(r => r.region_code === regionCode)?.region_name || '';
    const provinceName = provinces.find(p => p.province_code === provinceCode)?.province_name || '';
    const cityName = cities.find(c => c.city_code === cityCode)?.city_name || '';
    const brgyName = barangays.find(b => b.brgy_code === code)?.brgy_name || '';
    emitChange(regionName, provinceName, cityName, brgyName, regionCode, provinceCode, cityCode, code);
  };

  const emitChange = (region, province, city, barangay, regionCode, provinceCode, cityCode, barangayCode) => {
    if (onChange) {
      onChange({ region, province, city, barangay, regionCode, provinceCode, cityCode, barangayCode });
    }
  };

  const selectClass = "w-full bg-dark-800 border border-dark-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder-dark-500 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 appearance-none";

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center gap-2 mb-1">
        <MapPin className="w-3.5 h-3.5 text-primary-400" />
        <span className="text-dark-400 text-xs font-medium">Address</span>
      </div>

      {/* Region */}
      <div className="relative">
        <select value={regionCode} onChange={e => handleRegionChange(e.target.value)} className={selectClass}>
          <option value="">Select Region</option>
          {regions.map(r => (
            <option key={r.region_code} value={r.region_code}>{r.region_name}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-dark-500 pointer-events-none" />
      </div>

      {/* Province */}
      <div className="relative">
        <select value={provinceCode} onChange={e => handleProvinceChange(e.target.value)} disabled={!regionCode} className={`${selectClass} ${!regionCode ? 'opacity-50' : ''}`}>
          <option value="">{loadingProv ? 'Loading...' : 'Select Province'}</option>
          {provinces.map(p => (
            <option key={p.province_code} value={p.province_code}>{p.province_name}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-dark-500 pointer-events-none" />
      </div>

      {/* City / Municipality */}
      <div className="relative">
        <select value={cityCode} onChange={e => handleCityChange(e.target.value)} disabled={!provinceCode} className={`${selectClass} ${!provinceCode ? 'opacity-50' : ''}`}>
          <option value="">{loadingCity ? 'Loading...' : 'Select City / Municipality'}</option>
          {cities.map(c => (
            <option key={c.city_code} value={c.city_code}>{c.city_name}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-dark-500 pointer-events-none" />
      </div>

      {/* Barangay */}
      <div className="relative">
        <select value={barangayCode} onChange={e => handleBarangayChange(e.target.value)} disabled={!cityCode} className={`${selectClass} ${!cityCode ? 'opacity-50' : ''}`}>
          <option value="">{loadingBrgy ? 'Loading...' : 'Select Barangay'}</option>
          {barangays.map(b => (
            <option key={b.brgy_code} value={b.brgy_code}>{b.brgy_name}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-dark-500 pointer-events-none" />
      </div>
    </div>
  );
}
