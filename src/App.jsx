import React, { useState, useEffect, useRef } from 'react';
import { 
  Truck, Settings, Play, Pause, RotateCcw, Hammer, MapPin, 
  ArrowDown, ArrowUp, Clock, Activity, Database, CheckCircle2, 
  Hourglass, Sun, Moon, FileText, TrendingUp, AlertTriangle, 
  BarChart3, ListX, Map, ParkingCircle, Navigation, Printer,
  Calculator, ClipboardList, Timer, Sparkles, BrainCircuit, X
} from 'lucide-react';

// --- DEFINISI KONSTANTA & TIPE ---

const STATUS = {
  POOL_PARK: 'POOL_PARK',             
  TRAVEL_POOL_TO_QUARRY: 'TRAVEL_POOL_TO_QUARRY', 
  QUEUE_QUARRY: 'QUEUE_QUARRY',
  LOADING: 'LOADING',
  TRAVEL_ACCESS_OUT: 'TRAVEL_ACCESS_OUT',
  TRAVEL_MAIN_OUT: 'TRAVEL_MAIN_OUT',
  DUMP_ENTRY: 'DUMP_ENTRY',
  DUMPING: 'DUMPING',
  DUMP_EXIT: 'DUMP_EXIT',
  TRAVEL_MAIN_IN: 'TRAVEL_MAIN_IN',
  TRAVEL_ACCESS_IN: 'TRAVEL_ACCESS_IN',
  TRAVEL_DUMP_TO_POOL: 'TRAVEL_DUMP_TO_POOL' 
};

const START_POSITIONS = {
  POOL: 'POOL',           
  QUEUE: 'QUEUE',         
  DISTRIBUTED: 'DISTRIBUTED' 
};

const POOL_LOCATIONS = {
  QUARRY: 'QUARRY',
  DUMPING: 'DUMPING',
  OTHER: 'OTHER'
};

const DEFAULT_CONFIG = {
  truckCount: 5,
  excavatorCount: 1,    
  startHour: 7,         
  startMinute: 30,       
  endHour: 18,
  endMinute: 0,         
  
  loadingTime: 12,      
  accessRoadOut: 6,     
  mainRoadOut: 14,      
  dumpEntry: 4,         
  dumpingTime: 4,       
  dumpExit: 4,          
  mainRoadIn: 12,       
  accessRoadIn: 4,      
  
  poolToQuarryTime: 30,
  poolToQuarryDist: 15, 
  dumpingToPoolTime: 30,
  dumpingToPoolDist: 15, 
  
  bucketsPerTruck: 22,
  simulationSpeed: 50,
  
  initialPosition: START_POSITIONS.POOL,
  poolLocation: POOL_LOCATIONS.QUARRY,
};

// --- GEMINI API HELPER ---
const callGemini = async (prompt) => {
  const apiKey = ""; // API Key will be injected by environment
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });
    
    if (!response.ok) throw new Error('API Error');
    
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "Maaf, AI tidak dapat memberikan analisis saat ini.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Gagal terhubung ke layanan AI. Silakan coba lagi.";
  }
};

// --- KOMPONEN LAPORAN AKHIR (3 HALAMAN) ---
const ReportModal = ({ stats, trucks, config, snapshot1800, queueLogs, lastLoadInfo, lastDumpInfo, onRestart }) => {
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Helpers Waktu
  const formatTime = (totalMinutes) => {
    if (!totalMinutes) return "-";
    const h = Math.floor(totalMinutes / 60) % 24;
    const m = totalMinutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const finishTimeMinutes = (config.startHour * 60 + config.startMinute) + stats.elapsedMinutes;
  const finishTimeStr = formatTime(finishTimeMinutes);
  const closingTimeStr = `${config.endHour.toString().padStart(2, '0')}:${config.endMinute.toString().padStart(2, '0')}`;
  
  // Kalkulasi Volume & Optimalisasi
  const volPerBucket = 1.1; 
  const totalVolM3 = Math.round(stats.totalBuckets * volPerBucket);
  const truckCycleTime = config.loadingTime + config.accessRoadOut + config.mainRoadOut + config.dumpEntry + config.dumpingTime + config.dumpExit + config.mainRoadIn + config.accessRoadIn;
  const excavatorCycleTime = config.loadingTime;
  
  // FIX: Define missing variables
  const numTrucks = config.truckCount;
  const numExcavators = config.excavatorCount;

  const optimalTrucks = Math.round(truckCycleTime / excavatorCycleTime);
  const matchFactor = (numTrucks * excavatorCycleTime) / (numExcavators * truckCycleTime);
  
  const getMatchFactorStatus = (mf) => {
    if (mf < 0.85) return { status: "Undertrucked (Alat Muat Nganggur)", color: "text-amber-600" };
    if (mf > 1.15) return { status: "Overtrucked (Antrian Panjang)", color: "text-red-600" };
    return { status: "Matched (Ideal)", color: "text-green-600" };
  };

  const mfAnalysis = getMatchFactorStatus(matchFactor);

  const handleGenerateAIReport = async () => {
    setIsAiLoading(true);
    const contextData = {
      config: config,
      stats: stats,
      matchFactor: matchFactor.toFixed(2),
      optimalTrucks: optimalTrucks,
      cycleTime: truckCycleTime,
      logs: queueLogs.length > 10 ? queueLogs.slice(-10) : queueLogs, // Kirim sebagian log saja
      finishTime: finishTimeStr
    };

    const prompt = `
      Bertindaklah sebagai Kepala Teknik Tambang (KTT) Senior. 
      Analisis data operasional hauling berikut ini dan berikan laporan evaluasi profesional dalam Bahasa Indonesia.
      
      DATA OPERASIONAL:
      - Total Produksi: ${stats.totalTrips} Rit (${stats.totalBuckets} Bucket / ~${totalVolM3} m3)
      - Waktu Selesai Operasi: ${finishTimeStr} (Target Tutup: ${closingTimeStr})
      - Armada: ${numTrucks} Tronton, ${numExcavators} Excavator
      - Match Factor: ${matchFactor.toFixed(2)} (${matchFactor < 0.85 ? 'Undertrucked' : matchFactor > 1.15 ? 'Overtrucked' : 'Matched'})
      - Cycle Time Teoritis: ${truckCycleTime} menit
      - Jumlah Insiden Antrian/Penahanan: ${queueLogs.length} kejadian
      
      INSTRUKSI:
      1. Berikan "Executive Summary" singkat mengenai performa hari ini.
      2. Analisis efisiensi alat (Match Factor) dan dampaknya terhadap produksi.
      3. Identifikasi hambatan utama (bottleneck) jika ada.
      4. Berikan 3 rekomendasi taktis spesifik untuk operator atau pengawas lapangan besok.
      
      Gunakan gaya bahasa korporat pertambangan yang tegas, analitis, namun konstruktif. Gunakan format markdown bold/list.
    `;

    const result = await callGemini(prompt);
    setAiAnalysis(result);
    setIsAiLoading(false);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-sm animate-in fade-in duration-500 overflow-y-auto print:p-0 print:bg-white print:static print:block">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden my-8 print:shadow-none print:w-full print:max-w-none print:rounded-none">
        
        {/* HEADER ACTIONS */}
        <div className="bg-slate-800 p-4 text-white flex justify-between items-center print:hidden">
          <h2 className="text-xl font-bold flex items-center gap-2"><FileText /> Laporan Akhir Simulasi</h2>
          <div className="flex gap-2">
            <button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded flex items-center gap-2 font-bold"><Printer size={18}/> Cetak PDF</button>
            <button onClick={onRestart} className="bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded flex items-center gap-2 font-bold"><RotateCcw size={18}/> Restart</button>
          </div>
        </div>

        <div className="overflow-y-auto max-h-[85vh] print:max-h-none print:overflow-visible text-gray-800">
          
          {/* HALAMAN 1: SITUASI & HASIL */}
          <div className="p-10 print:p-0 print:h-screen flex flex-col relative box-border bg-white">
            <div className="border-b-4 border-slate-800 pb-4 mb-8">
              <h1 className="text-3xl font-extrabold text-slate-800 uppercase tracking-tight">Laporan Operasional Harian</h1>
              <div className="flex justify-between items-end mt-2">
                <p className="text-slate-500 font-medium">Bagian 1: Situasi Akhir & Hasil Produksi</p>
                <p className="text-slate-400 text-sm">PT Hamka Maju Karya</p>
              </div>
            </div>

            {/* Timeline */}
            <div className="mb-10">
              <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2 uppercase tracking-wide border-l-4 border-blue-500 pl-3">Kronologi Utama</h3>
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-center">
                  <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Mulai Operasi</div>
                  <div className="text-2xl font-bold text-slate-800">
                    {config.startHour.toString().padStart(2,'0')}:{config.startMinute.toString().padStart(2,'0')}
                  </div>
                </div>
                <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 text-center">
                  <div className="text-[10px] text-amber-700 font-bold uppercase mb-1">Last Load Out</div>
                  <div className="text-2xl font-bold text-amber-800">{lastLoadInfo ? lastLoadInfo.timeStr : '-'}</div>
                  <div className="text-[9px] text-amber-600 mt-1">Unit #{lastLoadInfo?.truckId || '?'}</div>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 text-center">
                  <div className="text-[10px] text-blue-700 font-bold uppercase mb-1">Last Dump Out</div>
                  <div className="text-2xl font-bold text-blue-800">{lastDumpInfo ? lastDumpInfo.timeStr : '-'}</div>
                  <div className="text-[9px] text-blue-600 mt-1">Unit #{lastDumpInfo?.truckId || '?'}</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg border border-green-200 text-center">
                  <div className="text-[10px] text-green-700 font-bold uppercase mb-1">Selesai Total</div>
                  <div className="text-2xl font-bold text-green-800">{finishTimeStr}</div>
                  <div className="text-[9px] text-green-600 mt-1">All Parked</div>
                </div>
              </div>
            </div>

            {/* Hasil Produksi */}
            <div className="mb-10">
              <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2 uppercase tracking-wide border-l-4 border-blue-500 pl-3">Pencapaian Produksi</h3>
              <div className="bg-slate-900 text-white rounded-xl p-8 flex flex-row justify-around items-center text-center print:bg-white print:text-black print:border-2 print:border-slate-800">
                <div>
                  <div className="text-xs opacity-70 uppercase tracking-widest mb-1 text-slate-300 print:text-slate-500">Ritase</div>
                  <div className="text-6xl font-mono font-bold text-amber-400 print:text-black">{stats.totalTrips}</div>
                  <div className="text-sm font-medium">Trip</div>
                </div>
                <div className="h-20 w-px bg-white/20 print:bg-slate-200"></div>
                <div>
                  <div className="text-xs opacity-70 uppercase tracking-widest mb-1 text-slate-300 print:text-slate-500">Total Muatan</div>
                  <div className="text-6xl font-mono font-bold text-blue-400 print:text-black">{stats.totalBuckets}</div>
                  <div className="text-sm font-medium">Bucket</div>
                </div>
                <div className="h-20 w-px bg-white/20 print:bg-slate-200"></div>
                <div>
                  <div className="text-xs opacity-70 uppercase tracking-widest mb-1 text-slate-300 print:text-slate-500">Volume Est.</div>
                  <div className="text-6xl font-mono font-bold text-green-400 print:text-black">{totalVolM3}</div>
                  <div className="text-sm font-medium">m³ (Loose)</div>
                </div>
              </div>
            </div>

            {/* Tabel Detail */}
            <div className="flex-grow">
              <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2 uppercase tracking-wide border-l-4 border-blue-500 pl-3">Rincian Armada</h3>
              <table className="w-full text-sm border-collapse border border-slate-200">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="p-3 text-left border-b border-slate-200">Unit ID</th>
                    <th className="p-3 text-center border-b border-slate-200">Ritase</th>
                    <th className="p-3 text-center border-b border-slate-200">Total Bucket</th>
                    <th className="p-3 text-center border-b border-slate-200">Volume (m³)</th>
                    <th className="p-3 text-right border-b border-slate-200">Efektivitas</th>
                  </tr>
                </thead>
                <tbody>
                  {trucks.map((t, idx) => (
                    <tr key={t.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="p-3 font-bold text-slate-700 border-b border-slate-100">DT-{t.id.toString().padStart(2,'0')}</td>
                      <td className="p-3 text-center border-b border-slate-100 font-mono">{t.trips}</td>
                      <td className="p-3 text-center border-b border-slate-100 text-slate-500">{t.trips * config.bucketsPerTruck}</td>
                      <td className="p-3 text-center border-b border-slate-100 font-medium text-slate-800">{Math.round(t.trips * config.bucketsPerTruck * volPerBucket)}</td>
                      <td className="p-3 text-right border-b border-slate-100 font-mono text-slate-500">
                        {stats.totalTrips > 0 ? ((t.trips / stats.totalTrips) * 100).toFixed(1) : 0}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="mt-auto pt-4 border-t border-slate-200 flex justify-between text-xs text-slate-400">
              <span>Dicetak pada: {new Date().toLocaleDateString()}</span>
              <span>Halaman 1 dari 3</span>
            </div>
          </div>

          {/* PAGE BREAK INDICATOR */}
          <div className="h-4 bg-gray-200 border-y border-dashed border-gray-400 flex items-center justify-center print:hidden">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest bg-gray-200 px-2">Page Break</span>
          </div>

          {/* HALAMAN 2: ANALISIS KONFIGURASI */}
          <div className="p-10 print:p-0 print:h-screen flex flex-col relative box-border bg-white break-before-page">
            <div className="border-b-4 border-slate-800 pb-4 mb-8">
              <h1 className="text-3xl font-extrabold text-slate-800 uppercase tracking-tight">Analisis Produktivitas</h1>
              <div className="flex justify-between items-end mt-2">
                <p className="text-slate-500 font-medium">Bagian 2: Optimalisasi Alat & Armada</p>
                <p className="text-slate-400 text-sm">PT Hamka Maju Karya</p>
              </div>
            </div>

            {/* Analisis Cycle Time */}
            <div className="mb-10">
              <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2 uppercase tracking-wide border-l-4 border-blue-500 pl-3">Cycle Time Analysis (CT)</h3>
              <div className="bg-white p-6 rounded-xl border-2 border-slate-100">
                <div className="flex justify-between items-center mb-6 text-sm md:text-base">
                   <div className="text-center flex-1">
                     <div className="text-2xl font-bold text-slate-800">{config.loadingTime}m</div>
                     <div className="text-xs uppercase font-bold text-slate-400 mt-1">Loading</div>
                   </div>
                   <div className="text-slate-300">➜</div>
                   <div className="text-center flex-1">
                     <div className="text-2xl font-bold text-slate-800">{config.accessRoadOut + config.mainRoadOut}m</div>
                     <div className="text-xs uppercase font-bold text-slate-400 mt-1">Hauling</div>
                   </div>
                   <div className="text-slate-300">➜</div>
                   <div className="text-center flex-1">
                     <div className="text-2xl font-bold text-slate-800">{config.dumpEntry + config.dumpingTime + config.dumpExit}m</div>
                     <div className="text-xs uppercase font-bold text-slate-400 mt-1">Dumping</div>
                   </div>
                   <div className="text-slate-300">➜</div>
                   <div className="text-center flex-1">
                     <div className="text-2xl font-bold text-slate-800">{config.mainRoadIn + config.accessRoadIn}m</div>
                     <div className="text-xs uppercase font-bold text-slate-400 mt-1">Return</div>
                   </div>
                </div>
                
                <div className="flex items-center justify-center bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <div className="text-center">
                    <div className="text-xs text-blue-600 font-bold uppercase tracking-wider mb-2">Total Cycle Time (Teoritis)</div>
                    <div className="text-5xl font-mono font-bold text-blue-900">{truckCycleTime} <span className="text-xl font-sans font-medium text-blue-600">Menit</span></div>
                    <div className="text-xs text-blue-400 mt-2">Waktu putar 1 unit tronton dalam kondisi lancar</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Analisis Match Factor */}
            <div className="mb-10 flex-grow">
              <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2 uppercase tracking-wide border-l-4 border-blue-500 pl-3">Match Factor (Keserasian Alat)</h3>
              
              <div className="grid grid-cols-2 gap-8">
                {/* Konfigurasi Saat Ini */}
                <div className="border border-slate-200 p-6 rounded-xl bg-white shadow-sm">
                  <h4 className="font-bold text-slate-700 mb-4 pb-2 border-b border-slate-100 flex items-center gap-2"><Settings size={16}/> Konfigurasi Aktual</h4>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-500">Alat Muat (Excavator)</span>
                      <span className="font-bold text-slate-800">{numExcavators} Unit</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-500">Alat Angkut (Tronton)</span>
                      <span className="font-bold text-slate-800">{numTrucks} Unit</span>
                    </div>
                    <div className="pt-4 border-t border-slate-100">
                      <div className="flex justify-between items-end mb-1">
                        <span className="text-sm font-bold text-slate-600">Nilai Match Factor</span>
                        <span className={`text-2xl font-bold ${mfAnalysis.color}`}>{matchFactor.toFixed(2)}</span>
                      </div>
                      <div className={`text-xs font-bold text-center px-3 py-1.5 rounded-full ${mfAnalysis.color.replace('text', 'bg').replace('600', '100')} text-opacity-80`}>
                        {mfAnalysis.status}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Rekomendasi */}
                <div className="border border-green-200 p-6 rounded-xl bg-green-50">
                  <h4 className="font-bold text-green-800 mb-4 pb-2 border-b border-green-200 flex items-center gap-2"><CheckCircle2 size={16}/> Rekomendasi Sistem</h4>
                  
                  <div className="text-center mb-6">
                    <div className="text-xs text-green-600 mb-1">Jumlah Armada Ideal</div>
                    <div className="text-4xl font-bold text-green-800">{optimalTrucks} <span className="text-lg font-normal">Unit</span></div>
                    <div className="text-[10px] text-green-500 mt-1">Untuk 1 Excavator agar MF mendekati 1.0</div>
                  </div>

                  <div className="bg-white/60 p-3 rounded-lg border border-green-100">
                    <p className="text-xs text-green-900 leading-relaxed font-medium">
                      {numTrucks < optimalTrucks && `Saat ini UNDERTRUCKED. Tambahkan ${optimalTrucks - numTrucks} unit tronton untuk mencegah Excavator menunggu.`}
                      {numTrucks > optimalTrucks && `Saat ini OVERTRUCKED. Kurangi ${numTrucks - optimalTrucks} unit tronton untuk mengurangi antrian di quarry.`}
                      {numTrucks === optimalTrucks && `Konfigurasi sudah IDEAL. Pertahankan jumlah unit untuk efisiensi maksimal.`}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-auto pt-4 border-t border-slate-200 flex justify-between text-xs text-slate-400">
              <span>Dicetak pada: {new Date().toLocaleDateString()}</span>
              <span>Halaman 2 dari 3</span>
            </div>
          </div>

          {/* PAGE BREAK INDICATOR */}
          <div className="h-4 bg-gray-200 border-y border-dashed border-gray-400 flex items-center justify-center print:hidden">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest bg-gray-200 px-2">Page Break</span>
          </div>

          {/* HALAMAN 3: LOG & KESIMPULAN (AI POWERED) */}
          <div className="p-10 print:p-0 print:h-screen flex flex-col relative box-border bg-white break-before-page">
            <div className="border-b-4 border-slate-800 pb-4 mb-8">
              <h1 className="text-3xl font-extrabold text-slate-800 uppercase tracking-tight">Evaluasi & Rekomendasi</h1>
              <div className="flex justify-between items-end mt-2">
                <p className="text-slate-500 font-medium">Bagian 3: Analisis Kinerja (AI Powered)</p>
                <p className="text-slate-400 text-sm">PT Hamka Maju Karya</p>
              </div>
            </div>

            {/* AI Generation Button */}
            <div className="mb-6 print:hidden">
              {!aiAnalysis ? (
                <button 
                  onClick={handleGenerateAIReport} 
                  disabled={isAiLoading}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4 rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-3 font-bold text-lg"
                >
                  {isAiLoading ? (
                    <><div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div> Menganalisis Data Simulasi...</>
                  ) : (
                    <><Sparkles size={24} className="text-yellow-300"/> Generate Analisis KTT (AI)</>
                  )}
                </button>
              ) : (
                <div className="bg-green-50 text-green-800 p-3 rounded-lg border border-green-200 flex items-center justify-between">
                  <span className="flex items-center gap-2 font-bold"><CheckCircle2 size={18}/> Analisis AI Selesai</span>
                  <button onClick={() => setAiAnalysis("")} className="text-xs underline">Generate Ulang</button>
                </div>
              )}
            </div>

            {/* Konten AI / Default */}
            <div className="flex-grow">
              {aiAnalysis ? (
                <div className="bg-indigo-50 p-8 rounded-xl border border-indigo-200 text-slate-800 text-sm leading-relaxed space-y-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-4 border-b border-indigo-200 pb-2">
                    <BrainCircuit className="text-indigo-600" size={24}/>
                    <h3 className="font-bold text-indigo-900 text-lg">Laporan Evaluasi KTT (AI Generated)</h3>
                  </div>
                  <div className="prose prose-sm max-w-none whitespace-pre-wrap font-medium">
                    {aiAnalysis}
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 p-8 rounded-xl border border-slate-200 text-sm text-slate-700 leading-relaxed space-y-6 text-justify">
                  <p>
                    <strong className="text-slate-900">Ringkasan Manual:</strong><br/>
                    Simulasi operasional hauling PT Hamka Maju Karya pada hari ini menunjukkan performa total <b>{stats.totalTrips} ritase</b>. 
                    Dengan konfigurasi {numTrucks} unit tronton dan {numExcavators} unit excavator, sistem mencapai tingkat efisiensi (Match Factor) sebesar <b>{matchFactor.toFixed(2)}</b>.
                  </p>
                  
                  <div className="bg-white p-5 rounded-lg border-l-4 border-slate-400 shadow-sm mt-4 text-center">
                    <p className="text-slate-500 italic">Klik tombol "Generate Analisis KTT" di atas untuk mendapatkan analisis mendalam, identifikasi bottleneck, dan rekomendasi strategis menggunakan Artificial Intelligence.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Log Penting (Compressed) */}
            <div className="mt-8">
              <h3 className="text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Log Kejadian Terakhir</h3>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-slate-100">
                    {queueLogs.slice(-5).map((log, i) => (
                      <tr key={i}><td className="p-2 font-mono text-slate-500 w-20">{log.time}</td><td className="p-2 text-slate-700">{log.message}</td></tr>
                    ))}
                    {queueLogs.length === 0 && <tr><td className="p-3 text-center text-slate-400 italic">Tidak ada log antrian.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-auto pt-4 border-t border-slate-200 flex justify-between text-xs text-slate-400">
              <span>Dicetak pada: {new Date().toLocaleDateString()}</span>
              <span>Halaman 3 dari 3 - Akhir Laporan</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

// --- CONFIG MODAL AI ADVISOR ---
const AIConfigAdvisor = ({ config, onClose, onApply }) => {
  const [advice, setAdvice] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const analyzeConfig = async () => {
      const truckCycleTime = config.loadingTime + config.accessRoadOut + config.mainRoadOut + config.dumpEntry + config.dumpingTime + config.dumpExit + config.mainRoadIn + config.accessRoadIn;
      const optimal = Math.round(truckCycleTime / config.loadingTime);
      
      const prompt = `
        Sebagai ahli perencanaan tambang, analisis konfigurasi awal ini:
        - Armada: ${config.truckCount} Tronton, ${config.excavatorCount} Excavator
        - Cycle Time Estimasi: ${truckCycleTime} menit
        - Loading Time: ${config.loadingTime} menit
        - Lokasi Pool: ${config.poolLocation}
        - Jam Operasi: ${config.startHour}:${config.startMinute} s/d ${config.endHour}:${config.endMinute}
        
        Berikan prediksi singkat (maksimal 3 kalimat) tentang potensi masalah (seperti antrian/idling) dan satu saran perubahan parameter konkret sebelum simulasi dimulai.
      `;
      
      const result = await callGemini(prompt);
      setAdvice(result);
      setLoading(false);
    };
    analyzeConfig();
  }, [config]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={20}/></button>
        <h3 className="text-lg font-bold text-indigo-800 mb-4 flex items-center gap-2"><Sparkles size={20}/> AI Strategist</h3>
        
        {loading ? (
          <div className="flex flex-col items-center py-8 gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <p className="text-sm text-slate-500">Menganalisis parameter...</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 text-sm text-indigo-900 leading-relaxed font-medium">
              {advice}
            </div>
            <button onClick={onClose} className="w-full bg-indigo-600 text-white py-2 rounded-lg font-bold hover:bg-indigo-700">Mengerti, Lanjutkan</button>
          </div>
        )}
      </div>
    </div>
  );
};

// --- KOMPONEN UTAMA APLIKASI ---

export default function App() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [trucks, setTrucks] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showAIAdvisor, setShowAIAdvisor] = useState(false); // State untuk AI Advisor
  
  const [isShiftEnding, setIsShiftEnding] = useState(false);
  const [isFullyStopped, setIsFullyStopped] = useState(false);
  const [closingLogicTriggered, setClosingLogicTriggered] = useState(false);
  const [snapshot1800, setSnapshot1800] = useState(null);
  const [queueLogs, setQueueLogs] = useState([]);
  const [lastLoggedTruckId, setLastLoggedTruckId] = useState(null); 
  const [lastLoadInfo, setLastLoadInfo] = useState(null);
  const [lastDumpInfo, setLastDumpInfo] = useState(null); 

  const [stats, setStats] = useState({
    totalTrips: 0,
    totalBuckets: 0,
    elapsedMinutes: 0,
  });

  const timerRef = useRef(null);
  const lastLoadInfoRef = useRef(null);
  const lastDumpInfoRef = useRef(null);

  // --- HELPER DURASI DINAMIS ---
  const getPoolToQuarryTime = (cfg) => {
    if (cfg.poolLocation === POOL_LOCATIONS.QUARRY) return 0;
    if (cfg.poolLocation === POOL_LOCATIONS.DUMPING) return cfg.dumpExit + cfg.mainRoadIn + cfg.accessRoadIn;
    return cfg.poolToQuarryTime;
  };

  const getDumpingToPoolTime = (cfg) => {
    if (cfg.poolLocation === POOL_LOCATIONS.QUARRY) return cfg.dumpExit + cfg.mainRoadIn + cfg.accessRoadIn; 
    if (cfg.poolLocation === POOL_LOCATIONS.DUMPING) return 0; 
    return cfg.dumpingToPoolTime;
  };

  const initializeTrucks = (cfg) => {
    let initialStatuses = [];
    
    // Logic Posisi Awal
    if (cfg.initialPosition === START_POSITIONS.DISTRIBUTED) {
      // TERSEBAR IDEAL: Hanya di jalur masuk (Pool -> Quarry)
      const travelTime = getPoolToQuarryTime(cfg);
      const interval = cfg.loadingTime; 

      for (let i = 0; i < cfg.truckCount; i++) {
        const minutesAway = i * interval; // Jarak waktu antar truk
        
        let status = STATUS.POOL_PARK;
        let progress = 0;
        let progressMin = 0;
        let startDelay = 0;

        if (minutesAway === 0) {
          // Truk pertama langsung antri
          status = STATUS.QUEUE_QUARRY;
        } else if (travelTime > 0 && minutesAway < travelTime) {
          // Truk di tengah perjalanan menuju quarry
          status = STATUS.TRAVEL_POOL_TO_QUARRY;
          const minutesTraveled = travelTime - minutesAway;
          progressMin = minutesTraveled;
          progress = (minutesTraveled / travelTime) * 100;
        } else {
          // Truk masih harus menunggu di pool
          status = STATUS.POOL_PARK;
          // Hitung berapa lama lagi dia harus menunggu di pool agar jaraknya pas
          startDelay = minutesAway - travelTime; 
        }
        
        initialStatuses.push({ status, progress, progressMin, startDelay });
      }

    } else if (cfg.initialPosition === START_POSITIONS.QUEUE) {
      for (let i = 0; i < cfg.truckCount; i++) {
        initialStatuses.push({ status: STATUS.QUEUE_QUARRY, progress: 0, progressMin: 0, startDelay: 0 });
      }
    } else {
      for (let i = 0; i < cfg.truckCount; i++) {
        initialStatuses.push({ status: STATUS.POOL_PARK, progress: 0, progressMin: 0, startDelay: 0 });
      }
    }

    const newTrucks = Array.from({ length: cfg.truckCount }, (_, i) => ({
      id: i + 1,
      status: initialStatuses[i].status,
      progress: initialStatuses[i].progress, 
      progressMinutes: initialStatuses[i].progressMin, 
      startDelay: initialStatuses[i].startDelay, 
      currentLoad: 0, trips: 0, loadsStarted: 0, 
      color: `hsl(${(i * 360) / cfg.truckCount}, 70%, 50%)`,
      hasLastTicket: false,
      isParked: initialStatuses[i].status === STATUS.POOL_PARK 
    }));

    setTrucks(newTrucks);
    setStats({ totalTrips: 0, totalBuckets: 0, elapsedMinutes: 0 });
    setQueueLogs([]);
    setIsPlaying(false);
    setIsShiftEnding(false);
    setIsFullyStopped(false);
    setClosingLogicTriggered(false);
    setSnapshot1800(null);
    setLastLoadInfo(null);
    setLastDumpInfo(null);
    lastLoadInfoRef.current = null;
    lastDumpInfoRef.current = null;
  };

  useEffect(() => { initializeTrucks(config); }, []);

  const getCurrentTime = () => {
    const totalMinutesStart = config.startHour * 60 + config.startMinute;
    const currentTotalMinutes = totalMinutesStart + stats.elapsedMinutes;
    const h = Math.floor(currentTotalMinutes / 60) % 24;
    const m = currentTotalMinutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const tick = () => {
    const totalMinutesStart = config.startHour * 60 + config.startMinute;
    const currentTotalMinutes = totalMinutesStart + stats.elapsedMinutes;
    const endMinutes = config.endHour * 60 + config.endMinute;
    const isPastClosing = currentTotalMinutes >= endMinutes;

    if (isPastClosing && !closingLogicTriggered) {
      setIsShiftEnding(true);
      setClosingLogicTriggered(true);
      const inQuarryCount = trucks.filter(t => [STATUS.QUEUE_QUARRY, STATUS.LOADING, STATUS.TRAVEL_ACCESS_IN, STATUS.POOL_PARK].includes(t.status)).length;
      const dumpingCount = trucks.filter(t => [STATUS.DUMPING, STATUS.DUMP_ENTRY, STATUS.DUMP_EXIT].includes(t.status)).length;
      setSnapshot1800({ inQuarry: inQuarryCount, dumping: dumpingCount, onRoad: config.truckCount - inQuarryCount - dumpingCount });
      setTrucks(curr => curr.map(t => {
        const allowed = [STATUS.TRAVEL_ACCESS_IN, STATUS.QUEUE_QUARRY, STATUS.LOADING, STATUS.TRAVEL_MAIN_IN, STATUS.TRAVEL_POOL_TO_QUARRY];
        return { ...t, hasLastTicket: allowed.includes(t.status) };
      }));
      return; 
    }

    const allParked = trucks.every(t => t.status === STATUS.POOL_PARK);
    if (isPastClosing && allParked) {
      setIsPlaying(false);
      setIsFullyStopped(true);
      setIsShiftEnding(false); 
      if (lastLoadInfoRef.current) setLastLoadInfo(lastLoadInfoRef.current);
      if (lastDumpInfoRef.current) setLastDumpInfo(lastDumpInfoRef.current);
      return;
    }

    setStats(prev => ({ ...prev, elapsedMinutes: prev.elapsedMinutes + 1 }));

    setTrucks(currentTrucks => {
      const activeLoadersCount = currentTrucks.filter(t => t.status === STATUS.LOADING).length;
      const slotsAvailable = config.excavatorCount - activeLoadersCount;
      const minLoadsStarted = Math.min(...currentTrucks.map(t => t.loadsStarted));

      const queueCandidates = currentTrucks.filter(t => {
        if (t.status !== STATUS.QUEUE_QUARRY) return false;
        if (isShiftEnding && !t.hasLastTicket) return false;
        if (config.initialPosition !== START_POSITIONS.DISTRIBUTED && t.loadsStarted > minLoadsStarted) return false;
        // Distributed start handles synchronization via delays, so we can relax the load checker initially
        if (config.initialPosition === START_POSITIONS.DISTRIBUTED && stats.elapsedMinutes > 60 && t.loadsStarted > minLoadsStarted) return false;
        return true;
      });

      // Simplified logging logic to save space
      if (slotsAvailable > 0 && stats.elapsedMinutes > 60) {
        const forcedWaitTrucks = currentTrucks.filter(t => t.status === STATUS.QUEUE_QUARRY && t.loadsStarted > minLoadsStarted && (isShiftEnding ? t.hasLastTicket : true));
        if (forcedWaitTrucks.length > 0) {
           const victim = forcedWaitTrucks[0];
           if (lastLoggedTruckId !== victim.id && Math.random() > 0.8) { 
              const tm = config.startHour * 60 + config.startMinute + stats.elapsedMinutes;
              const timeStr = `${Math.floor(tm/60)%24}:${(tm%60).toString().padStart(2,'0')}`;
              setQueueLogs(prev => [...prev.slice(-9), { time: timeStr, message: `Tronton #${victim.id} ditahan (Sinkronisasi)` }]);
              setLastLoggedTruckId(victim.id);
           }
        }
      }

      const queueIds = queueCandidates.map(t => t.id);
      const idsAllowedToEnter = queueIds.slice(0, Math.max(0, slotsAvailable));
      const poolToQuarryTime = getPoolToQuarryTime(config);
      const dumpingToPoolTime = getDumpingToPoolTime(config);

      return currentTrucks.map(truck => {
        let newStatus = truck.status;
        let newProgressMin = truck.progressMinutes;
        let newLoad = truck.currentLoad;
        let newProgress = truck.progress;
        let newTicketStatus = truck.hasLastTicket;
        let newIsParked = truck.isParked;
        let newStartDelay = truck.startDelay;
        let tripsAdded = 0;
        let loadsStartedAdded = 0;

        const advanceStatus = (nextStatus) => { newStatus = nextStatus; newProgressMin = 0; newProgress = 0; };

        // Handle Pool Delay Logic
        if (truck.status === STATUS.POOL_PARK && isPlaying && !isShiftEnding) {
           if (newStartDelay > 0) {
             newStartDelay -= 1; 
           } else {
             newIsParked = false;
             if (poolToQuarryTime > 0) {
               advanceStatus(STATUS.TRAVEL_POOL_TO_QUARRY);
             } else {
               advanceStatus(STATUS.QUEUE_QUARRY);
             }
           }
        }

        switch (truck.status) {
          case STATUS.TRAVEL_POOL_TO_QUARRY:
            newProgressMin += 1;
            newProgress = (newProgressMin / poolToQuarryTime) * 100;
            if (newProgressMin >= poolToQuarryTime) advanceStatus(STATUS.QUEUE_QUARRY);
            break;

          case STATUS.QUEUE_QUARRY:
            if (!newIsParked && idsAllowedToEnter.includes(truck.id)) {
              advanceStatus(STATUS.LOADING);
              loadsStartedAdded = 1;
              if (isShiftEnding) newTicketStatus = false;
            } else if (isShiftEnding && !truck.hasLastTicket) {
              if (config.poolLocation === POOL_LOCATIONS.QUARRY) {
                newIsParked = true;
                newStatus = STATUS.POOL_PARK;
              } else {
                 newIsParked = true; 
                 newStatus = STATUS.POOL_PARK;
              }
            }
            break;

          case STATUS.LOADING:
            newProgressMin += 1;
            newLoad = Math.min(config.bucketsPerTruck, Math.floor((newProgressMin / config.loadingTime) * config.bucketsPerTruck));
            newProgress = (newProgressMin / config.loadingTime) * 100;
            if (newProgressMin >= config.loadingTime) {
              newLoad = config.bucketsPerTruck;
              advanceStatus(STATUS.TRAVEL_ACCESS_OUT);
              const tm = config.startHour * 60 + config.startMinute + stats.elapsedMinutes;
              const timeStr = `${Math.floor(tm/60)%24}:${(tm%60).toString().padStart(2,'0')}`;
              lastLoadInfoRef.current = { timeStr, totalMinutes: tm, truckId: truck.id };
            }
            break;

          case STATUS.TRAVEL_ACCESS_OUT:
            newProgressMin += 1;
            newProgress = (newProgressMin / config.accessRoadOut) * 100;
            if (newProgressMin >= config.accessRoadOut) advanceStatus(STATUS.TRAVEL_MAIN_OUT);
            break;

          case STATUS.TRAVEL_MAIN_OUT:
            newProgressMin += 1;
            newProgress = (newProgressMin / config.mainRoadOut) * 100;
            if (newProgressMin >= config.mainRoadOut) advanceStatus(STATUS.DUMP_ENTRY);
            break;

          case STATUS.DUMP_ENTRY:
            newProgressMin += 1;
            newProgress = (newProgressMin / config.dumpEntry) * 100;
            if (newProgressMin >= config.dumpEntry) advanceStatus(STATUS.DUMPING);
            break;

          case STATUS.DUMPING:
            newProgressMin += 1;
            newLoad = Math.max(0, config.bucketsPerTruck - Math.floor((newProgressMin / config.dumpingTime) * config.bucketsPerTruck));
            newProgress = (newProgressMin / config.dumpingTime) * 100;
            if (newProgressMin >= config.dumpingTime) {
              newLoad = 0;
              tripsAdded = 1;
              setStats(prev => ({ ...prev, totalTrips: prev.totalTrips + 1, totalBuckets: prev.totalBuckets + config.bucketsPerTruck }));
              advanceStatus(STATUS.DUMP_EXIT);
            }
            break;

          case STATUS.DUMP_EXIT:
            newProgressMin += 1;
            newProgress = (newProgressMin / config.dumpExit) * 100;
            if (newProgressMin >= config.dumpExit) {
               const tm = config.startHour * 60 + config.startMinute + stats.elapsedMinutes;
               const timeStr = `${Math.floor(tm/60)%24}:${(tm%60).toString().padStart(2,'0')}`;
               lastDumpInfoRef.current = { timeStr, totalMinutes: tm, truckId: truck.id };

               if (isShiftEnding && config.poolLocation !== POOL_LOCATIONS.QUARRY) {
                 if (config.poolLocation === POOL_LOCATIONS.DUMPING) {
                   newIsParked = true;
                   advanceStatus(STATUS.POOL_PARK);
                 } else {
                   advanceStatus(STATUS.TRAVEL_DUMP_TO_POOL);
                 }
               } else {
                 advanceStatus(STATUS.TRAVEL_MAIN_IN);
               }
            }
            break;

          case STATUS.TRAVEL_MAIN_IN:
            newProgressMin += 1;
            newProgress = (newProgressMin / config.mainRoadIn) * 100;
            if (newProgressMin >= config.mainRoadIn) advanceStatus(STATUS.TRAVEL_ACCESS_IN);
            break;

          case STATUS.TRAVEL_ACCESS_IN:
            newProgressMin += 1;
            newProgress = (newProgressMin / config.accessRoadIn) * 100;
            if (newProgressMin >= config.accessRoadIn) advanceStatus(STATUS.QUEUE_QUARRY);
            break;

          case STATUS.TRAVEL_DUMP_TO_POOL:
             newProgressMin += 1;
             newProgress = (newProgressMin / dumpingToPoolTime) * 100;
             if (newProgressMin >= dumpingToPoolTime) {
               newIsParked = true;
               advanceStatus(STATUS.POOL_PARK);
             }
             break;
            
          default: break;
        }

        return {
          ...truck,
          status: newStatus,
          progressMinutes: newProgressMin,
          progress: newProgress,
          currentLoad: newLoad,
          hasLastTicket: newTicketStatus,
          isParked: newIsParked,
          startDelay: newStartDelay,
          trips: truck.trips + tripsAdded,
          loadsStarted: truck.loadsStarted + loadsStartedAdded
        };
      });
    });
  };

  useEffect(() => {
    if (isPlaying) {
      const currentDelay = isShiftEnding ? config.simulationSpeed / 0.75 : config.simulationSpeed;
      timerRef.current = setInterval(tick, currentDelay);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isPlaying, config.simulationSpeed, isShiftEnding, stats.elapsedMinutes]); 

  const handleConfigChange = (key, value) => { setConfig(prev => ({ ...prev, [key]: value })); };
  const handleRestart = () => { initializeTrucks(config); };

  const PhaseCard = ({ title, subtitle, icon: Icon, type, trucksInPhase, duration, isQueue = false }) => {
    let bgColor, borderColor, titleColor;
    if (type === 'park') {
       bgColor = 'bg-slate-100'; borderColor = 'border-slate-300'; titleColor = 'text-slate-700';
    } else {
       bgColor = type === 'load' ? 'bg-amber-50 border-amber-200' : type === 'travel-full' ? 'bg-orange-50 border-orange-200' : type === 'dump' ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200';
       titleColor = type === 'load' ? 'text-amber-800' : type === 'travel-full' ? 'text-orange-800' : type === 'dump' ? 'text-red-800' : 'text-emerald-800';
    }

    return (
      <div className={`relative p-3 rounded-xl border-2 ${bgColor} ${borderColor} mb-3 shadow-sm transition-all duration-500`}>
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-full bg-white bg-opacity-60`}><Icon size={18} className={titleColor} /></div>
            <div>
              <h3 className={`font-bold text-sm ${titleColor}`}>{title}</h3>
              <p className="text-xs text-gray-500 font-medium">
                 {subtitle ? subtitle : (isQueue ? (type === 'park' ? 'Unit Parkir' : 'Menunggu') : `Estimasi: ${duration} menit`)}
              </p>
            </div>
          </div>
          <div className="text-xs font-bold bg-white px-2 py-1 rounded shadow-sm text-gray-700">{trucksInPhase.length} Unit</div>
        </div>
        <div className="space-y-2 min-h-[20px]">
          {trucksInPhase.length === 0 && <div className="text-center text-xs text-gray-400 py-2 italic opacity-50">Kosong</div>}
          {trucksInPhase.map(truck => (
            <div key={truck.id} className={`p-2 rounded border shadow-sm relative overflow-hidden transition-all duration-500 ${truck.isParked ? 'bg-slate-200 border-slate-300 grayscale' : 'bg-white border-gray-100'}`}>
              {!isQueue && !truck.isParked && <div className="absolute left-0 top-0 bottom-0 bg-opacity-20 transition-all duration-300 ease-linear" style={{ width: `${truck.progress}%`, backgroundColor: truck.color }} />}
              <div className="relative flex justify-between items-center z-10">
                <div className="flex items-center gap-2">
                  <Truck size={16} style={{ color: truck.isParked ? '#64748b' : truck.color }} />
                  <span className={`text-xs font-bold ${truck.isParked ? 'text-slate-600' : 'text-gray-700'}`}>Tronton #{truck.id}</span>
                </div>
                {/* STATUS BARU: Menunggu Jadwal Jalan (Distributed) */}
                {truck.startDelay > 0 && truck.isParked && (
                   <span className="text-[9px] bg-blue-100 text-blue-800 px-1 rounded border border-blue-200 font-medium">Tunggu {truck.startDelay}m</span>
                )}
                {!truck.isParked && type === 'queue' && truck.loadsStarted > Math.min(...trucks.map(t=>t.loadsStarted)) && <span className="text-[9px] bg-red-100 text-red-800 px-1 rounded border border-red-200 font-medium">Tahan Sesi</span>}
                {type === 'load' && <span className="text-xs font-mono text-gray-600">{truck.currentLoad}/{config.bucketsPerTruck} Bkt</span>}
                {!isQueue && type !== 'load' && !truck.isParked && <span className="text-[10px] font-mono text-gray-400">{Math.round(truck.progress)}%</span>}
                {truck.isParked && <CheckCircle2 size={14} className="text-slate-500" />}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const getTrucksByStatus = (status) => trucks.filter(t => t.status === status);
  const trucksInPool = getTrucksByStatus(STATUS.POOL_PARK);
  const poolToQuarryTime = getPoolToQuarryTime(config);

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800 pb-20 md:pb-0">
      
      {isFullyStopped && <ReportModal stats={stats} trucks={trucks} config={config} snapshot1800={snapshot1800} queueLogs={queueLogs} lastLoadInfo={lastLoadInfo} lastDumpInfo={lastDumpInfo} onRestart={handleRestart} />}
      
      {/* AI ADVISOR MODAL */}
      {showAIAdvisor && (
        <AIConfigAdvisor 
          config={config} 
          onClose={() => setShowAIAdvisor(false)} 
        />
      )}

      <header className={`text-white p-4 shadow-lg sticky top-0 z-30 transition-colors duration-500 ${isShiftEnding ? 'bg-amber-600' : (isFullyStopped ? 'bg-slate-800' : 'bg-slate-900')}`}>
        <div className="max-w-md mx-auto flex justify-between items-center">
          <div><h1 className="font-bold text-lg leading-tight">PT Hamka Maju Karya</h1><p className="text-xs text-white/80">{isFullyStopped ? 'SIMULASI SELESAI' : (isShiftEnding ? 'PENYELESAIAN SHIFT' : 'Simulasi Operasional')}</p></div>
          <button onClick={() => setShowConfig(!showConfig)} className={`p-2 rounded-full transition-colors ${showConfig ? 'bg-white/20 text-white' : 'bg-black/20 text-white/70'}`}><Settings size={20} /></button>
        </div>
      </header>

       {isShiftEnding && !isFullyStopped && <div className="max-w-md mx-auto px-4 pt-4 animate-in fade-in zoom-in duration-300"><div className="bg-amber-100 border border-amber-300 text-amber-800 px-3 py-2 rounded text-center shadow-sm flex items-center justify-center gap-2"><Hourglass size={16} className="animate-spin-slow"/><span className="text-xs font-bold">Menyelesaikan antrian & perjalanan akhir...</span></div></div>}

      {showConfig && (
        <div className="bg-white border-b border-gray-200 p-4 shadow-inner animate-in slide-in-from-top-2">
          <div className="max-w-md mx-auto space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-bold text-gray-700 flex items-center gap-2"><Settings size={16}/> Konfigurasi</h2>
              {/* BUTTON AI STRATEGIST */}
              <button 
                onClick={() => setShowAIAdvisor(true)}
                className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 transition-colors"
              >
                <Sparkles size={14} /> Cek Strategi AI
              </button>
            </div>
            
            {/* OPSI START & POOL */}
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 space-y-2">
               <label className="text-xs font-bold text-blue-800 uppercase">Strategi & Lokasi</label>
               <div className="grid grid-cols-2 gap-2">
                 <div className="flex flex-col"><label className="text-[10px] text-gray-500 mb-1">Posisi Mulai</label><select value={config.initialPosition} onChange={(e) => handleConfigChange('initialPosition', e.target.value)} className="text-xs border border-gray-300 rounded px-2 py-1 outline-none"><option value={START_POSITIONS.POOL}>Semua Parkir (Pool)</option><option value={START_POSITIONS.QUEUE}>Semua Antri (Quarry)</option><option value={START_POSITIONS.DISTRIBUTED}>Tersebar (Ideal Flow)</option></select></div>
                 <div className="flex flex-col"><label className="text-[10px] text-gray-500 mb-1">Lokasi Pool</label><select value={config.poolLocation} onChange={(e) => handleConfigChange('poolLocation', e.target.value)} className="text-xs border border-gray-300 rounded px-2 py-1 outline-none"><option value={POOL_LOCATIONS.QUARRY}>Quarry (Loading)</option><option value={POOL_LOCATIONS.DUMPING}>Dumping (Bongkar)</option><option value={POOL_LOCATIONS.OTHER}>Lainnya (Custom)</option></select></div>
               </div>
               {config.poolLocation === POOL_LOCATIONS.OTHER && (
                 <div className="grid grid-cols-2 gap-2 pt-2 border-t border-blue-200">
                    <ConfigInput label="Jarak Pool->Quarry (km)" value={config.poolToQuarryDist} onChange={(v) => handleConfigChange('poolToQuarryDist', parseInt(v))} />
                    <ConfigInput label="Waktu Pool->Quarry (m)" value={config.poolToQuarryTime} onChange={(v) => handleConfigChange('poolToQuarryTime', parseInt(v))} />
                    <ConfigInput label="Jarak Dump->Pool (km)" value={config.dumpingToPoolDist} onChange={(v) => handleConfigChange('dumpingToPoolDist', parseInt(v))} />
                    <ConfigInput label="Waktu Dump->Pool (m)" value={config.dumpingToPoolTime} onChange={(v) => handleConfigChange('dumpingToPoolTime', parseInt(v))} />
                 </div>
               )}
            </div>

            <div className="grid grid-cols-2 gap-3"><ConfigInput label="Jml Tronton" value={config.truckCount} onChange={(v) => handleConfigChange('truckCount', parseInt(v))} min={1} max={50} /><ConfigInput label="Jml Excavator" value={config.excavatorCount} onChange={(v) => handleConfigChange('excavatorCount', parseInt(v))} min={1} max={5} /></div>
            <div className="grid grid-cols-2 gap-3"><TimeConfigInput label="Jam Mulai" hour={config.startHour} minute={config.startMinute} onHourChange={(v) => handleConfigChange('startHour', parseInt(v))} onMinuteChange={(v) => handleConfigChange('startMinute', parseInt(v))} /><TimeConfigInput label="Jam Selesai" hour={config.endHour} minute={config.endMinute} onHourChange={(v) => handleConfigChange('endHour', parseInt(v))} onMinuteChange={(v) => handleConfigChange('endMinute', parseInt(v))} /></div>
            <div className="space-y-2 pt-2 border-t"><p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Durasi Proses (Menit)</p><div className="grid grid-cols-2 gap-2"><ConfigInput label="Loading" value={config.loadingTime} onChange={(v) => handleConfigChange('loadingTime', parseInt(v))} /><ConfigInput label="Jalan (Isi)" value={config.accessRoadOut} onChange={(v) => handleConfigChange('accessRoadOut', parseInt(v))} /><ConfigInput label="Jalan Raya (Isi)" value={config.mainRoadOut} onChange={(v) => handleConfigChange('mainRoadOut', parseInt(v))} /><ConfigInput label="Masuk Dumping" value={config.dumpEntry} onChange={(v) => handleConfigChange('dumpEntry', parseInt(v))} /><ConfigInput label="Bongkar" value={config.dumpingTime} onChange={(v) => handleConfigChange('dumpingTime', parseInt(v))} /><ConfigInput label="Keluar Dumping" value={config.dumpExit} onChange={(v) => handleConfigChange('dumpExit', parseInt(v))} /><ConfigInput label="Jalan Raya (Ksg)" value={config.mainRoadIn} onChange={(v) => handleConfigChange('mainRoadIn', parseInt(v))} /><ConfigInput label="Jalan (Ksg)" value={config.accessRoadIn} onChange={(v) => handleConfigChange('accessRoadIn', parseInt(v))} /></div></div>
            <div className="grid grid-cols-1"><ConfigInput label="Kecepatan Sim (ms/tick)" value={config.simulationSpeed} onChange={(v) => handleConfigChange('simulationSpeed', parseInt(v))} min={20} max={500} step={10} /></div>
            <button onClick={() => { handleRestart(); setShowConfig(false); }} className="w-full bg-slate-800 text-white py-2 rounded-lg font-bold text-sm hover:bg-slate-700">Terapkan & Reset</button>
          </div>
        </div>
      )}

      <div className="bg-white border-b border-gray-200 sticky top-[72px] z-20 shadow-sm"><div className="max-w-md mx-auto grid grid-cols-3 divide-x divide-gray-100"><StatBox label="JAM" value={getCurrentTime()} icon={isFullyStopped ? Moon : (isShiftEnding ? Hourglass : Sun)} className={isShiftEnding ? "text-amber-600" : "text-gray-800"} /><StatBox label="Total Rit" value={stats.totalTrips} icon={MapPin} /><StatBox label="Tanah Urug" value={stats.totalBuckets} unit="Bucket" icon={Database} highlight /></div></div>

      {/* VISUALIZATION FLOW */}
      <main className="max-w-md mx-auto p-4 space-y-4">
        
        {/* WIDGET POOL (BARU) */}
        <div className="space-y-1">
          <SectionHeader title={`Pool Utama (${config.poolLocation})`} color="text-slate-600"/>
          <PhaseCard 
            title="Area Parkir Pool" 
            subtitle={`Jarak ke Quarry: ${config.poolLocation === POOL_LOCATIONS.QUARRY ? '0 km (Di Tempat)' : (config.poolLocation === POOL_LOCATIONS.DUMPING ? 'Via Rute Balik' : `${config.poolToQuarryDist} km`)}`}
            icon={ParkingCircle} 
            type="park" 
            trucksInPhase={trucksInPool} 
            isQueue={true} 
          />
          {poolToQuarryTime > 0 && (
             <PhaseCard title="Perjalanan Pool ke Quarry" icon={Navigation} type="travel-empty" duration={poolToQuarryTime} trucksInPhase={getTrucksByStatus(STATUS.TRAVEL_POOL_TO_QUARRY)} />
          )}
        </div>
        <ArrowSeparator />

        <div className="space-y-1">
          <SectionHeader title="Quarry (Lokasi Muat)" />
          <PhaseCard title="Antrian Loading" subtitle={isShiftEnding ? "Menghabiskan antrian..." : undefined} icon={Clock} type="queue" trucksInPhase={getTrucksByStatus(STATUS.QUEUE_QUARRY).filter(t => !t.isParked)} isQueue={true} />
          <PhaseCard title={`Loading (PC200)`} subtitle={`${config.excavatorCount} Unit Operasi | Durasi: ${config.loadingTime}m`} icon={Hammer} type="load" duration={config.loadingTime} trucksInPhase={getTrucksByStatus(STATUS.LOADING)} />
        </div>
        <ArrowSeparator />
        
        <div className="space-y-1">
          <SectionHeader title="Perjalanan (Muatan Penuh)" color="text-orange-700" />
          <PhaseCard title="Jalan Akses (Keluar)" icon={ArrowUp} type="travel-full" duration={config.accessRoadOut} trucksInPhase={getTrucksByStatus(STATUS.TRAVEL_ACCESS_OUT)} />
          <PhaseCard title="Jalan Raya (Menuju Lokasi)" icon={ArrowUp} type="travel-full" duration={config.mainRoadOut} trucksInPhase={getTrucksByStatus(STATUS.TRAVEL_MAIN_OUT)} />
        </div>
        <ArrowSeparator />
        
        <div className="space-y-1">
          <SectionHeader title="Area Bongkar (Tepi Jalan)" color="text-red-700" />
          <PhaseCard title="Masuk Area Bongkar" icon={ArrowDown} type="dump" duration={config.dumpEntry} trucksInPhase={getTrucksByStatus(STATUS.DUMP_ENTRY)} />
          <PhaseCard title="Proses Bongkar" icon={Database} type="dump" duration={config.dumpingTime} trucksInPhase={getTrucksByStatus(STATUS.DUMPING)} />
          <PhaseCard title="Keluar ke Jalan Raya" icon={ArrowUp} type="dump" duration={config.dumpExit} trucksInPhase={getTrucksByStatus(STATUS.DUMP_EXIT)} />
        </div>
        
        {/* LOGIC UNTUK PERJALANAN BALIK / PULANG */}
        {(config.poolLocation === POOL_LOCATIONS.OTHER || config.poolLocation === POOL_LOCATIONS.QUARRY) && (
          <>
            <ArrowSeparator />
            <div className="space-y-1">
              <SectionHeader title={isShiftEnding && config.poolLocation === POOL_LOCATIONS.OTHER ? "Perjalanan Pulang (Ke Pool Lain)" : "Perjalanan Kembali (Kosong)"} color="text-emerald-700" />
              
              {/* Jika pulang ke Pool Lain */}
              {config.poolLocation === POOL_LOCATIONS.OTHER && (
                <PhaseCard title="Perjalanan Dump ke Pool" icon={Navigation} type="travel-empty" duration={config.dumpingToPoolTime} trucksInPhase={getTrucksByStatus(STATUS.TRAVEL_DUMP_TO_POOL)} />
              )}

              {/* Siklus Normal (Balik ke Quarry) */}
              {config.poolLocation === POOL_LOCATIONS.QUARRY && (
                <>
                  <PhaseCard title="Jalan Raya (Kembali)" icon={ArrowDown} type="travel-empty" duration={config.mainRoadIn} trucksInPhase={getTrucksByStatus(STATUS.TRAVEL_MAIN_IN)} />
                  <PhaseCard title="Jalan Akses (Masuk Quarry)" icon={ArrowDown} type="travel-empty" duration={config.accessRoadIn} trucksInPhase={getTrucksByStatus(STATUS.TRAVEL_ACCESS_IN)} />
                </>
              )}
            </div>
          </>
        )}
        
        <div className="flex justify-center py-2 text-gray-400"><RotateCcw size={24} /></div>
      </main>

      <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-40">
        <button onClick={handleRestart} className="p-3 bg-white text-slate-700 rounded-full shadow-lg border border-gray-200 hover:bg-gray-50 active:scale-95 transition-all" title="Reset"><RotateCcw size={24} /></button>
        <button onClick={() => { if(!isFullyStopped) setIsPlaying(!isPlaying); }} disabled={isFullyStopped} className={`p-4 rounded-full shadow-lg text-white transition-all active:scale-95 flex items-center justify-center ${isFullyStopped ? 'bg-gray-400 cursor-not-allowed' : (isPlaying ? (isShiftEnding ? 'bg-amber-500 hover:bg-amber-600 animate-pulse' : 'bg-amber-500 hover:bg-amber-600') : 'bg-blue-600 hover:bg-blue-700')}`}>
          {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
        </button>
      </div>
    </div>
  );
}

const ConfigInput = ({ label, value, onChange, min = 1, max = 100, step = 1 }) => (
  <div className="flex flex-col"><label className="text-xs text-gray-500 mb-1">{label}</label><input type="number" value={value} onChange={(e) => onChange(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none" min={min} max={max} step={step} /></div>
);
const TimeConfigInput = ({ label, hour, minute, onHourChange, onMinuteChange }) => (
  <div className="flex flex-col"><label className="text-xs text-gray-500 mb-1">{label}</label><div className="flex items-center gap-1"><input type="number" value={hour} onChange={(e) => onHourChange(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full text-center" min={0} max={23} placeholder="HH" /><span className="font-bold text-gray-400">:</span><input type="number" value={minute.toString().padStart(2, '0')} onChange={(e) => onMinuteChange(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full text-center" min={0} max={59} step={5} placeholder="MM" /></div></div>
);
const StatBox = ({ label, value, unit, icon: Icon, highlight = false, className = "", iconClass = "" }) => (
  <div className={`p-3 text-center flex flex-col items-center justify-center transition-all ${className}`}><div className={`flex items-center gap-1 mb-1 ${iconClass || "text-gray-400"}`}><Icon size={14} /><span className="text-[10px] uppercase font-bold tracking-wider">{label}</span></div><div className={`font-mono font-bold text-lg leading-none ${!className ? (highlight ? 'text-blue-600' : 'text-gray-800') : ''}`}>{value} <span className="text-xs font-sans text-gray-500 font-normal">{unit}</span></div></div>
);
const SectionHeader = ({ title, color = "text-gray-500" }) => (<h2 className={`text-xs font-bold uppercase tracking-widest pl-1 ${color}`}>{title}</h2>);
const ArrowSeparator = () => (<div className="flex justify-center py-1 opacity-20"><ArrowDown size={20} /></div>);