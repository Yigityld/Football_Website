import React, { useState, useEffect } from 'react';

const Home = () => {
  const [formData, setFormData] = useState({
    teamA: '',
    teamB: '',
    mainRef: '',
    sideRef: '',
    youtubeUrl: ''
  });
  
  const [teamAJersey, setTeamAJersey] = useState(null);
  const [teamBJersey, setTeamBJersey] = useState(null);
  const [loading, setLoading] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState('idle');
  const [analysisMessage, setAnalysisMessage] = useState('');
  const [analysisResults, setAnalysisResults] = useState(null);
  const [prediction, setPrediction] = useState('');         
  const [predicting, setPredicting] = useState(false);
  const [testResult, setTestResult] = useState('');


  // Backend URL'ini ayarla - production'da Render URL'ini kullan
  const BASE_URL = process.env.REACT_APP_API_URL || 'https://football-api.onrender.com';

  // Test backend bağlantısı
  const testBackendConnection = async () => {
    try {
      const response = await fetch(`${BASE_URL}/test`);
      const data = await response.json();
      setTestResult(`✅ Backend çalışıyor: ${data.message}`);
    } catch (error) {
      setTestResult(`❌ Backend hatası: ${error.message}`);
    }
  };


  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };


  const handleFileChange = (e, team) => {
    const file = e.target.files[0];
    if (file) {
      if (team === 'A') {
        setTeamAJersey(file);
      } else {
        setTeamBJersey(file);
      }
    }
  };


    const handleStartAnalysis = async (e) => {
  e.preventDefault();
  setLoading(true);
  setAnalysisStatus('starting');
  setAnalysisMessage('Analiz başlatılıyor...');

  const formDataToSend = new FormData();
  formDataToSend.append('team_a', formData.teamA || 'defaultTeamA');
  formDataToSend.append('team_b', formData.teamB || 'defaultTeamB');
  formDataToSend.append('main_ref', formData.mainRef || '');
  formDataToSend.append('side_ref', formData.sideRef || '');
  if (formData.youtubeUrl) {
    formDataToSend.append('youtube_url', formData.youtubeUrl);
  }
  if (teamAJersey) {
    formDataToSend.append('team_a_jersey', teamAJersey);
  }
  if (teamBJersey) {
    formDataToSend.append('team_b_jersey', teamBJersey);
  }

  try {
    const response = await fetch(`${BASE_URL}/start-analysis`, {

      method: 'POST',
      body: formDataToSend
    });

    const text = await response.text();
    let result = null;
    try {
      result = text ? JSON.parse(text) : null;
    } catch (parseErr) {
      console.warn("Yanıt JSON değil:", parseErr);
    }

    if (response.ok && result) {
      setAnalysisStatus('running');
      setAnalysisMessage('🔄 Analiz devam ediyor...');

      const interval = setInterval(async () => {
      const statusResponse = await fetch(`${BASE_URL}/analysis-status`);

        const statusResult = await statusResponse.json();

        if (statusResult.status === 'completed') {
          clearInterval(interval);
          setAnalysisStatus('completed');
          setAnalysisMessage('✅ Analiz tamamlandı!');
          setAnalysisResults(statusResult.results);
          setLoading(false);
        }
      }, 5000);
    } else {
      setAnalysisStatus('error');
      setAnalysisMessage('❌ Analiz başlatılamadı');
      setLoading(false);
    }

  } catch (err) {
    console.error("İstek hatası:", err);
    setAnalysisStatus('error');
    setAnalysisMessage('❌ Bağlantı hatası');
    setLoading(false);
  }
};



    // — Tahmin butonuna tıklanınca çalışacak
  const handlePredict = async () => {
    if (!formData.teamA || !formData.teamB) return;
    setPredicting(true);
    setPrediction('');
    try {
        const res = await fetch(`${BASE_URL}/predict-match`, {

        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          team_a: formData.teamA,
          team_b: formData.teamB
        })
      });
      const data = await res.json();
      setPrediction(data.prediction || 'Tahmin alınamadı');
    } catch {
      setPrediction('Tahmin hatası');
    } finally {
      setPredicting(false);
    }
  };



  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Animated Background Grid */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(rgba(59, 130, 246, 0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59, 130, 246, 0.3) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
          animation: 'gridMove 20s linear infinite'
        }}></div>
      </div>

      {/* Floating Particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-cyan-400 rounded-full animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${2 + Math.random() * 3}s`
            }}
          />
        ))}
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto">
          {/* Header with Enhanced Styling */}
          <div className="text-center mb-16">
            <div className="inline-block p-2 rounded-full bg-gradient-to-r from-cyan-500/20 to-purple-500/20 backdrop-blur-sm border border-cyan-500/30 mb-6">
              <div className="w-16 h-16 mx-auto bg-gradient-to-r from-cyan-400 to-purple-500 rounded-full flex items-center justify-center">
                <span className="text-2xl">⚽</span>
              </div>
            </div>
            <h1 className="text-7xl font-black bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent mb-6 animate-pulse">
              Futbol Analiz AI
            </h1>
            <p className="text-2xl text-gray-300 font-light tracking-wide">
              Yapay Zeka Destekli Maç Analizi Sistemi
            </p>
            <div className="mt-4 flex justify-center space-x-2">
              <span className="px-3 py-1 bg-cyan-500/20 text-cyan-300 rounded-full text-sm border border-cyan-500/30">YOLO Tespit</span>
              <span className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm border border-purple-500/30">Renk Analizi</span>
              <span className="px-3 py-1 bg-green-500/20 text-green-300 rounded-full text-sm border border-green-500/30">Gerçek Zamanlı</span>
            </div>
            
            {/* Test Backend Connection Button */}
            <div className="mt-6 flex justify-center">
              <button
                onClick={testBackendConnection}
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-blue-500/25 transition-all duration-300 transform hover:scale-105 active:scale-95"
              >
                🔗 Backend Bağlantısını Test Et
              </button>
            </div>
            
            {testResult && (
              <div className="mt-4 text-center">
                <p className={`text-lg ${testResult.includes('✅') ? 'text-green-400' : 'text-red-400'}`}>
                  {testResult}
                </p>
              </div>
            )}
          </div>

          {/* Enhanced Main Form */}
          <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 rounded-3xl border border-white/20 shadow-2xl p-10 mb-8 relative overflow-hidden">
            {/* Form Background Glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-purple-500/5 to-pink-500/5 rounded-3xl"></div>

            {/* Corner Decorations */}
            <div className="absolute top-0 left-0 w-20 h-20 border-l-2 border-t-2 border-cyan-400 rounded-tl-3xl"></div>
            <div className="absolute top-0 right-0 w-20 h-20 border-r-2 border-t-2 border-purple-400 rounded-tr-3xl"></div>
            <div className="absolute bottom-0 left-0 w-20 h-20 border-l-2 border-b-2 border-green-400 rounded-bl-3xl"></div>
            <div className="absolute bottom-0 right-0 w-20 h-20 border-r-2 border-b-2 border-pink-400 rounded-br-3xl"></div>

            <form onSubmit={handleStartAnalysis} className="relative z-10 space-y-8">
              {/* Teams Section with Enhanced Cards */}
              <div className="grid md:grid-cols-2 gap-8">
                {/* Team A Card */}
                <div className="group relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
                  <div className="relative bg-black/40 backdrop-blur-sm rounded-2xl p-6 border border-cyan-500/30 hover:border-cyan-400/50 transition-all duration-300">
                    <div className="flex items-center mb-4">
                      <div className="w-8 h-8 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full flex items-center justify-center mr-3">
                        <span className="text-white font-bold">A</span>
                      </div>
                      <h3 className="text-xl font-bold text-cyan-300">Takım A</h3>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-cyan-200 mb-2">
                          Takım Adı
                        </label>
                        <input
                          type="text"
                          name="teamA"
                          value={formData.teamA}
                          onChange={handleInputChange}
                          placeholder="Takım A adını girin..."
                          className="w-full px-4 py-3 bg-black/50 border border-cyan-500/50 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30 transition-all duration-300"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Team B Card */}
                <div className="group relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
                  <div className="relative bg-black/40 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/30 hover:border-purple-400/50 transition-all duration-300">
                    <div className="flex items-center mb-4">
                      <div className="w-8 h-8 bg-gradient-to-r from-purple-400 to-pink-500 rounded-full flex items-center justify-center mr-3">
                        <span className="text-white font-bold">B</span>
                      </div>
                      <h3 className="text-xl font-bold text-purple-300">Takım B</h3>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-purple-200 mb-2">
                          Takım Adı
                        </label>
                        <input
                          type="text"
                          name="teamB"
                          value={formData.teamB}
                          onChange={handleInputChange}
                          placeholder="Takım B adını girin..."
                          className="w-full px-4 py-3 bg-black/50 border border-purple-500/50 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/30 transition-all duration-300"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Referees Section with Enhanced Cards */}
              <div className="grid md:grid-cols-2 gap-8">
                {/* Main Referee Card */}
                <div className="group relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
                  <div className="relative bg-black/40 backdrop-blur-sm rounded-2xl p-6 border border-yellow-500/30 hover:border-yellow-400/50 transition-all duration-300">
                    <div className="flex items-center mb-4">
                      <div className="w-8 h-8 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mr-3">
                        <span className="text-white font-bold">👨‍⚖</span>
                      </div>
                      <h3 className="text-xl font-bold text-yellow-300">Ana Hakem</h3>
                    </div>

                    <input
                      type="text"
                      name="mainRef"
                      value={formData.mainRef}
                      onChange={handleInputChange}
                      placeholder="Ana hakem adını girin..."
                      className="w-full px-4 py-3 bg-black/50 border border-yellow-500/50 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/30 transition-all duration-300"
                    />
                  </div>
                </div>

                {/* Side Referee Card */}
                <div className="group relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
                  <div className="relative bg-black/40 backdrop-blur-sm rounded-2xl p-6 border border-orange-500/30 hover:border-orange-400/50 transition-all duration-300">
                    <div className="flex items-center mb-4">
                      <div className="w-8 h-8 bg-gradient-to-r from-orange-400 to-red-500 rounded-full flex items-center justify-center mr-3">
                        <span className="text-white font-bold">👨‍⚖</span>
                      </div>
                      <h3 className="text-xl font-bold text-orange-300">Yan Hakem</h3>
                    </div>

                    <input
                      type="text"
                      name="sideRef"
                      value={formData.sideRef}
                      onChange={handleInputChange}
                      placeholder="Yan hakem adını girin..."
                      className="w-full px-4 py-3 bg-black/50 border border-orange-500/50 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/30 transition-all duration-300"
                    />
                  </div>
                </div>
              </div>

              {/* Enhanced Action Button */}
              <div className="flex justify-center pt-8">
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
                  <button
                    type="submit"
                    disabled={loading || analysisStatus === 'running'}
                    className="relative px-16 py-6 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold text-2xl rounded-2xl shadow-2xl hover:shadow-green-500/25 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95"
                  >
                    {loading ? (
                      <div className="flex items-center space-x-3">
                        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Başlatılıyor...</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-3">
                        <span className="text-3xl">🔍</span>
                        <span>Analizi Başlat</span>
                      </div>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Enhanced Analysis Status */}
          {analysisStatus !== 'idle' && (
            <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 rounded-3xl border border-white/20 shadow-2xl p-8 mb-8 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-cyan-500/5 rounded-3xl"></div>

              <div className="relative z-10">
                <div className="flex items-center mb-6">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full flex items-center justify-center mr-4">
                    <span className="text-2xl">📊</span>
                  </div>
                  <h3 className="text-2xl font-bold text-blue-400">Analiz Durumu</h3>
                </div>

                <div className="bg-black/40 backdrop-blur-sm rounded-2xl p-6 border border-blue-500/30">
                  <p className="text-white text-xl mb-4">{analysisMessage}</p>
                  {analysisStatus === 'running' && (
                    <div className="space-y-4">
                      <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                        <div className="bg-gradient-to-r from-blue-500 to-purple-500 h-full rounded-full animate-pulse" style={{width: '60%'}}></div>
                      </div>
                      <p className="text-gray-300 text-sm">Takım ve hakem bilgileri çekiliyor...</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Analysis Results Display */}
          {analysisResults && (
            <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 rounded-3xl border border-white/20 shadow-2xl p-8 mt-8">

              <h2 className="text-3xl font-bold text-center text-cyan-300 mb-8">📊 Analiz Sonuçları</h2>

              {/* Teams Section */}
              <div className="grid md:grid-cols-2 gap-8 mb-8">
                {/* Team A */}
                <div className="bg-gradient-to-br from-cyan-900/60 to-cyan-700/40 rounded-2xl shadow-xl p-8 backdrop-blur-md border border-cyan-400/30">
                  <div className="flex items-center mb-6">
                    {analysisResults.teams.team_a.logo && (
                      <img
                        src={`data:image/png;base64,${analysisResults.teams.team_a.logo}`}
                        alt="Team A Logo"
                        className="w-16 h-16 rounded-full mr-4 border-4 border-cyan-300 shadow-lg"
                      />
                    )}
                    <h3 className="text-3xl font-extrabold text-cyan-200 tracking-tight drop-shadow-lg">{analysisResults.teams.team_a.name}</h3>
                  </div>

                  <div className="space-y-2 text-base text-cyan-100 mb-6">
                    <div><span className="font-bold text-cyan-300">Lig:</span> {analysisResults.teams.team_a.info.Lig || 'Bilinmiyor'}</div>
                    <div><span className="font-bold text-cyan-300">Sıralama:</span> {analysisResults.teams.team_a.info['Lig Sıralaması'] || '?'}</div>
                    <div><span className="font-bold text-cyan-300">Kadro Değeri:</span> {analysisResults.teams.team_a.info['Kadro Değeri'] || 'Bilinmiyor'}</div>
                    <div><span className="font-bold text-cyan-300">Yaş Ortalaması:</span> {analysisResults.teams.team_a.info['Yaş Ortalaması'] || 'Bilinmiyor'}</div>
                  </div>

                  <div className="bg-gradient-to-br from-cyan-800/60 to-cyan-600/40 rounded-2xl shadow-lg p-6 backdrop-blur-md border border-cyan-400/20">
                    <h4 className="text-cyan-200 text-xl font-extrabold mb-4 flex items-center gap-2">
                      <span className="material-icons text-2xl"></span>
                      Son 5 Maç
                    </h4>
                    <div className="space-y-3">
                      {analysisResults.teams.team_a.last_matches.map((match, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between px-3 py-2 rounded-xl transition-all duration-200 hover:bg-cyan-400/10"
                        >
                          <span className="font-semibold text-cyan-100">{match.rakip}</span>
                          <span className="font-mono text-lg font-bold text-cyan-200">{match.sonuc}</span>
                          <span className="text-2xl">
                            {match.emoji === '✅' ? '✔️' : match.emoji === '❌' ? '❌' : '➖'}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex justify-between text-sm text-cyan-300 font-medium">
                      <span>Galibiyet: {analysisResults.teams.team_a.stats.wins}</span>
                      <span>Beraberlik: {analysisResults.teams.team_a.stats.draws}</span>
                      <span>Mağlubiyet: {analysisResults.teams.team_a.stats.losses}</span>
                    </div>
                  </div>
                </div>

                {/* Team B */}
                <div className="bg-gradient-to-br from-purple-900/60 to-purple-700/40 rounded-2xl shadow-xl p-8 backdrop-blur-md border border-purple-400/30">
                  <div className="flex items-center mb-6">
                    {analysisResults.teams.team_b.logo && (
                      <img
                        src={`data:image/png;base64,${analysisResults.teams.team_b.logo}`}
                        alt="Team B Logo"
                        className="w-16 h-16 rounded-full mr-4 border-4 border-purple-300 shadow-lg"
                      />
                    )}
                    <h3 className="text-3xl font-extrabold text-purple-200 tracking-tight drop-shadow-lg">{analysisResults.teams.team_b.name}</h3>
                  </div>

                  <div className="space-y-2 text-base text-purple-100 mb-6">
                    <div><span className="font-bold text-purple-300">Lig:</span> {analysisResults.teams.team_b.info.Lig || 'Bilinmiyor'}</div>
                    <div><span className="font-bold text-purple-300">Sıralama:</span> {analysisResults.teams.team_b.info['Lig Sıralaması'] || '?'}</div>
                    <div><span className="font-bold text-purple-300">Kadro Değeri:</span> {analysisResults.teams.team_b.info['Kadro Değeri'] || 'Bilinmiyor'}</div>
                    <div><span className="font-bold text-purple-300">Yaş Ortalaması:</span> {analysisResults.teams.team_b.info['Yaş Ortalaması'] || 'Bilinmiyor'}</div>
                  </div>

                  <div className="bg-gradient-to-br from-purple-800/60 to-purple-600/40 rounded-2xl shadow-lg p-6 backdrop-blur-md border border-purple-400/20">
                    <h4 className="text-purple-200 text-xl font-extrabold mb-4 flex items-center gap-2">
                      <span className="material-icons text-2xl">sports_soccer</span>
                      Son 5 Maç
                    </h4>
                    <div className="space-y-3">
                      {analysisResults.teams.team_b.last_matches.map((match, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between px-3 py-2 rounded-xl transition-all duration-200 hover:bg-purple-400/10"
                        >
                          <span className="font-semibold text-purple-100">{match.rakip}</span>
                          <span className="font-mono text-lg font-bold text-purple-200">{match.sonuc}</span>
                          <span className="text-2xl">
                            {match.emoji === '✅' ? '✔️' : match.emoji === '❌' ? '❌' : '➖'}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex justify-between text-sm text-purple-300 font-medium">
                      <span>Galibiyet: {analysisResults.teams.team_b.stats.wins}</span>
                      <span>Beraberlik: {analysisResults.teams.team_b.stats.draws}</span>
                      <span>Mağlubiyet: {analysisResults.teams.team_b.stats.losses}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Referees Section */}
              {(analysisResults.referees.main || analysisResults.referees.side) && (
                <div className="mb-12">
                  <h2 className="text-3xl font-extrabold text-center text-green-300 mb-8 flex items-center justify-center gap-2 drop-shadow-lg">
                    <span className="text-3xl">👨‍⚖️</span> Hakem Bilgileri
                  </h2>
                  <div className="grid md:grid-cols-2 gap-8">
                    {/* Ana Hakem */}
                    {analysisResults.referees.main && (
                      <div className="bg-gradient-to-br from-green-900/60 to-green-700/40 rounded-2xl shadow-xl p-8 flex flex-col items-center border border-green-400/30">
                        {analysisResults.referees.main.photo && (
                          <img src={`data:image/png;base64,${analysisResults.referees.main.photo}`} alt="Ana Hakem" className="w-20 h-20 rounded-full mb-4 border-4 border-green-300 shadow-lg" />
                        )}
                        <h3 className="text-2xl font-extrabold text-green-200 mb-2 font-sans tracking-tight">{analysisResults.referees.main.name || "Ana Hakem"}</h3>
                        <div className="text-base text-green-100 space-y-1 text-center font-mono">
                          <div dangerouslySetInnerHTML={{ __html: analysisResults.referees.main.info }} />
                        </div>
                      </div>
                    )}
                    {/* Yan Hakem */}
                    {analysisResults.referees.side && (
                      <div className="bg-gradient-to-br from-yellow-900/60 to-yellow-700/40 rounded-2xl shadow-xl p-8 flex flex-col items-center border border-yellow-400/30">
                        {analysisResults.referees.side.photo && (
                          <img src={`data:image/png;base64,${analysisResults.referees.side.photo}`} alt="Yan Hakem" className="w-20 h-20 rounded-full mb-4 border-4 border-yellow-300 shadow-lg" />
                        )}
                        <h3 className="text-2xl font-extrabold text-yellow-200 mb-2 font-sans tracking-tight">{analysisResults.referees.side.name || "Yan Hakem"}</h3>
                        <div className="text-base text-yellow-100 space-y-1 text-center font-mono">
                          <div dangerouslySetInnerHTML={{ __html: analysisResults.referees.side.info }} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Head to Head Matches */}
              {analysisResults.head_to_head && analysisResults.head_to_head.length > 0 && (
                <div className="bg-gradient-to-br from-yellow-900/60 to-yellow-700/40 rounded-2xl shadow-xl p-8 border border-yellow-400/30 mb-8">
                  <h3 className="text-2xl font-extrabold text-center text-yellow-300 mb-6 flex items-center gap-2 drop-shadow-lg">
                    <span className="text-2xl">⚽</span> İki Takım Arası Son Maçlar
                  </h3>
                  <div className="space-y-3">
                    {analysisResults.head_to_head.map((match, idx) => (
                      <div key={idx} className="flex justify-between items-center px-6 py-3 bg-yellow-500/10 rounded-xl font-mono text-lg font-semibold text-yellow-100 shadow hover:bg-yellow-500/20 transition-all">
                        <span>{match.guest_team}</span>
                        <span className="text-yellow-300 font-bold">{match.result}</span>
                        <span>{match.home_team}</span>
                        <span className="text-yellow-200 text-sm">{match.date}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-center mt-6">
                    <button
                      onClick={handlePredict}
                      disabled={predicting || analysisStatus !== 'completed'}
                      className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 font-bold text-lg shadow"
                    >
                      {predicting ? 'Tahmin Yapılıyor…' : 'Gpt ile Tahmin Et'}
                    </button>
                  </div>
                  <div className="mt-6 p-4 bg-white/10 rounded-xl border border-white/20">
                    <h3 className="text-xl font-bold text-center text-green-300 mb-2 font-sans">
                      🤖 Maç Sonucu Tahmini
                    </h3>
                    {prediction
                      ? <p className="text-center text-white text-2xl font-mono">{prediction}</p>
                      : <p className="text-center text-gray-400">Butona basın, tahmin gelsin</p>
                    }
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Custom CSS for animations */}
      <style jsx>{`
        @keyframes gridMove {
          0% { transform: translate(0, 0); }
          100% { transform: translate(50px, 50px); }
        }
      `}</style>
    </div>
  );
};

export default Home;