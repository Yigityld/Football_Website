import React, { useState, useEffect } from 'react';

const PRIMARY = 'text-blue-500';
const ACCENT = 'text-amber-500';
const BG_CARD = 'bg-zinc-800';
const BORDER_CARD = 'border-zinc-700';
const BG_MAIN = 'bg-zinc-900';
const TEXT_MAIN = 'text-zinc-200';
const TEXT_SUB = 'text-zinc-400';

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
  const [showGoalAnalysis, setShowGoalAnalysis] = useState(false);
  const [goalStats, setGoalStats] = useState(null);
  const [showAnalysis, setShowAnalysis] = useState(false);


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


  const handleGoalAnalysis = () => {
  if (!analysisResults) return;
  const teamAMatches = analysisResults.teams.team_a.last_matches || [];
  const teamBMatches = analysisResults.teams.team_b.last_matches || [];
  const headToHead = analysisResults.head_to_head || [];
  const sumGoals = matches =>
    matches.reduce((sum, m) => {
      const parts = (m.sonuc || m.result || '').split(':');
      return sum + (parseInt(parts[0]) || 0) + (parseInt(parts[1]) || 0);
    }, 0);
  setGoalStats({
    teamA: sumGoals(teamAMatches),
    teamB: sumGoals(teamBMatches),
    headToHead: sumGoals(headToHead)
  });
  setShowGoalAnalysis(true);
};

const handleAnalysis = () => {
  setShowAnalysis(true);
};


  return (
    <div className={`${BG_MAIN} min-h-screen relative overflow-hidden`}>
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
          {/* Header */}
          <div className="text-center mb-16">
            <div className="inline-block p-2 rounded-full bg-zinc-800 border border-zinc-700 mb-6">
              <div className="w-16 h-16 mx-auto bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-2xl text-white">⚽</span>
              </div>
            </div>
            <h1 className="text-5xl font-black text-blue-400 mb-4">Futbol Analiz AI</h1>
            <p className="text-xl text-zinc-300 font-light tracking-wide mb-2">Yapay Zeka Destekli Maç Analizi Sistemi</p>
            <div className="mt-4 flex justify-center space-x-2">
              <span className="px-3 py-1 bg-blue-600/10 text-blue-400 rounded-full text-sm border border-blue-600/20">YOLO Tespit</span>
              <span className="px-3 py-1 bg-amber-500/10 text-amber-400 rounded-full text-sm border border-amber-500/20">Renk Analizi</span>
              <span className="px-3 py-1 bg-green-500/10 text-green-400 rounded-full text-sm border border-green-500/20">Gerçek Zamanlı</span>
            </div>
            <div className="mt-6 flex justify-center">
              <button
                onClick={testBackendConnection}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-lg transition-all duration-300"
              >
                🔗 Backend Bağlantısını Test Et
              </button>
            </div>
            {testResult && (
              <div className="mt-4 text-center">
                <p className={`text-lg ${testResult.includes('✅') ? 'text-green-400' : 'text-red-400'}`}>{testResult}</p>
              </div>
            )}
          </div>

          {/* Main Form */}
          <div className="bg-zinc-800/80 rounded-2xl border border-zinc-700 shadow-2xl p-10 mb-8">
            <form onSubmit={handleStartAnalysis} className="space-y-8">
              <div className="grid md:grid-cols-2 gap-8">
                {/* Team A Card */}
                <div className={`${BG_CARD} rounded-lg border ${BORDER_CARD} p-6 shadow-md`}>
                  <div className="flex items-center mb-4">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center mr-3">
                      <span className="text-white font-bold">A</span>
                    </div>
                    <h3 className="text-lg font-bold text-blue-400">Takım A</h3>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-blue-300 mb-2">Takım Adı</label>
                    <input
                      type="text"
                      name="teamA"
                      value={formData.teamA}
                      onChange={handleInputChange}
                      placeholder="Takım A adını girin..."
                      className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30 transition-all duration-300"
                    />
                  </div>
                </div>
                {/* Team B Card */}
                <div className={`${BG_CARD} rounded-lg border ${BORDER_CARD} p-6 shadow-md`}>
                  <div className="flex items-center mb-4">
                    <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center mr-3">
                      <span className="text-white font-bold">B</span>
                    </div>
                    <h3 className="text-lg font-bold text-amber-400">Takım B</h3>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-amber-300 mb-2">Takım Adı</label>
                    <input
                      type="text"
                      name="teamB"
                      value={formData.teamB}
                      onChange={handleInputChange}
                      placeholder="Takım B adını girin..."
                      className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30 transition-all duration-300"
                    />
                  </div>
                </div>
              </div>
              {/* Referees Section */}
              <div className="grid md:grid-cols-2 gap-8">
                {/* Main Referee Card */}
                <div className={`${BG_CARD} rounded-lg border ${BORDER_CARD} p-6 shadow-md`}>
                  <div className="flex items-center mb-4">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center mr-3">
                      <span className="text-white font-bold">👨‍⚖</span>
                    </div>
                    <h3 className="text-lg font-bold text-green-400">Ana Hakem</h3>
                  </div>
                  <input
                    type="text"
                    name="mainRef"
                    value={formData.mainRef}
                    onChange={handleInputChange}
                    placeholder="Ana hakem adını girin..."
                    className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-400/30 transition-all duration-300"
                  />
                </div>
                {/* Side Referee Card */}
                <div className={`${BG_CARD} rounded-lg border ${BORDER_CARD} p-6 shadow-md`}>
                  <div className="flex items-center mb-4">
                    <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center mr-3">
                      <span className="text-white font-bold">👨‍⚖</span>
                    </div>
                    <h3 className="text-lg font-bold text-red-400">Yan Hakem</h3>
                  </div>
                  <input
                    type="text"
                    name="sideRef"
                    value={formData.sideRef}
                    onChange={handleInputChange}
                    placeholder="Yan hakem adını girin..."
                    className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-400/30 transition-all duration-300"
                  />
                </div>
              </div>
              {/* Action Button */}
              <div className="flex justify-center pt-8">
                <button
                  type="submit"
                  disabled={loading || analysisStatus === 'running'}
                  className="px-16 py-6 bg-blue-600 hover:bg-blue-700 text-white font-bold text-2xl rounded-lg shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
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
            </form>
          </div>

          {/* Analysis Status */}
          {analysisStatus !== 'idle' && (
            <div className="bg-zinc-800/80 rounded-2xl border border-zinc-700 shadow-2xl p-8 mb-8">
              <div className="flex items-center mb-6">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mr-4">
                  <span className="text-2xl text-white">📊</span>
                </div>
                <h3 className="text-2xl font-bold text-blue-400">Analiz Durumu</h3>
              </div>
              <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-700">
                <p className="text-white text-xl mb-4">{analysisMessage}</p>
                {analysisStatus === 'running' && (
                  <div className="space-y-4">
                    <div className="w-full bg-zinc-700 rounded-full h-3 overflow-hidden">
                      <div className="bg-blue-600 h-full rounded-full animate-pulse" style={{width: '60%'}}></div>
                    </div>
                    <p className="text-zinc-400 text-sm">Takım ve hakem bilgileri çekiliyor...</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Analysis Results Display */}
          {analysisResults && (
            <div className="bg-zinc-800/80 rounded-2xl border border-zinc-700 shadow-2xl p-8 mt-8">
              <h2 className="text-3xl font-bold text-center text-blue-400 mb-8">📊 Analiz Sonuçları</h2>
              {/* Teams Section */}
              <div className="grid md:grid-cols-2 gap-8 mb-8">
                {/* Team A */}
                <div className={`${BG_CARD} rounded-lg border ${BORDER_CARD} shadow-md p-8`}>
                  <div className="flex items-center mb-6">
                    {analysisResults.teams.team_a.logo && (
                      <img
                        src={`data:image/png;base64,${analysisResults.teams.team_a.logo}`}
                        alt="Team A Logo"
                        className="w-16 h-16 rounded-full mr-4 border-4 border-blue-400 shadow-lg"
                      />
                    )}
                    <h3 className="text-3xl font-extrabold text-blue-200 tracking-tight drop-shadow-lg">{analysisResults.teams.team_a.name}</h3>
                  </div>
                  <div className="space-y-2 text-base text-blue-100 mb-6">
                    <div><span className="font-bold text-blue-300">Lig:</span> {analysisResults.teams.team_a.info.Lig || 'Bilinmiyor'}</div>
                    <div><span className="font-bold text-blue-300">Sıralama:</span> {analysisResults.teams.team_a.info['Lig Sıralaması'] || '?'}</div>
                    <div><span className="font-bold text-blue-300">Kadro Değeri:</span> {analysisResults.teams.team_a.info['Kadro Değeri'] || 'Bilinmiyor'}</div>
                    <div><span className="font-bold text-blue-300">Yaş Ortalaması:</span> {analysisResults.teams.team_a.info['Yaş Ortalaması'] || 'Bilinmiyor'}</div>
                  </div>
                  <div className="bg-zinc-900 rounded-xl shadow p-6 border border-zinc-700">
                    <h4 className="text-blue-200 text-xl font-extrabold mb-4 flex items-center gap-2">Son 5 Maç</h4>
                    <div className="space-y-3">
                      {analysisResults.teams.team_a.last_matches.map((match, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-200 hover:bg-blue-600/10"
                        >
                          <span className="font-semibold text-blue-100">{match.rakip}</span>
                          <span className="font-mono text-lg font-bold text-blue-200">{match.sonuc}</span>
                          <span className="text-xs text-blue-300 ml-2">{match.dizilis || ''}</span>
                          <span className="text-2xl">{match.emoji === '✅' ? '✔️' : match.emoji === '❌' ? '❌' : '➖'}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex justify-between text-sm text-blue-300 font-medium">
                      <span>Galibiyet: {analysisResults.teams.team_a.stats.wins}</span>
                      <span>Beraberlik: {analysisResults.teams.team_a.stats.draws}</span>
                      <span>Mağlubiyet: {analysisResults.teams.team_a.stats.losses}</span>
                    </div>
                  </div>
                </div>
                {/* Team B */}
                <div className={`${BG_CARD} rounded-lg border ${BORDER_CARD} shadow-md p-8`}>
                  <div className="flex items-center mb-6">
                    {analysisResults.teams.team_b.logo && (
                      <img
                        src={`data:image/png;base64,${analysisResults.teams.team_b.logo}`}
                        alt="Team B Logo"
                        className="w-16 h-16 rounded-full mr-4 border-4 border-amber-400 shadow-lg"
                      />
                    )}
                    <h3 className="text-3xl font-extrabold text-amber-200 tracking-tight drop-shadow-lg">{analysisResults.teams.team_b.name}</h3>
                  </div>
                  <div className="space-y-2 text-base text-amber-100 mb-6">
                    <div><span className="font-bold text-amber-300">Lig:</span> {analysisResults.teams.team_b.info.Lig || 'Bilinmiyor'}</div>
                    <div><span className="font-bold text-amber-300">Sıralama:</span> {analysisResults.teams.team_b.info['Lig Sıralaması'] || '?'}</div>
                    <div><span className="font-bold text-amber-300">Kadro Değeri:</span> {analysisResults.teams.team_b.info['Kadro Değeri'] || 'Bilinmiyor'}</div>
                    <div><span className="font-bold text-amber-300">Yaş Ortalaması:</span> {analysisResults.teams.team_b.info['Yaş Ortalaması'] || 'Bilinmiyor'}</div>
                  </div>
                  <div className="bg-zinc-900 rounded-xl shadow p-6 border border-zinc-700">
                    <h4 className="text-amber-200 text-xl font-extrabold mb-4 flex items-center gap-2">Son 5 Maç</h4>
                    <div className="space-y-3">
                      {analysisResults.teams.team_b.last_matches.map((match, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-200 hover:bg-amber-500/10"
                        >
                          <span className="font-semibold text-amber-100">{match.rakip}</span>
                          <span className="font-mono text-lg font-bold text-amber-200">{match.sonuc}</span>
                          <span className="text-xs text-amber-300 ml-2">{match.dizilis || ''}</span>
                          <span className="text-2xl">{match.emoji === '✅' ? '✔️' : match.emoji === '❌' ? '❌' : '➖'}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex justify-between text-sm text-amber-300 font-medium">
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
                  <h2 className="text-3xl font-extrabold text-center text-green-400 mb-8 flex items-center justify-center gap-2 drop-shadow-lg">
                    <span className="text-3xl">👨‍⚖️</span> Hakem Bilgileri
                  </h2>
                  <div className="grid md:grid-cols-2 gap-8">
                    {/* Ana Hakem */}
                    {analysisResults.referees.main && (
                      <div className={`${BG_CARD} rounded-lg border ${BORDER_CARD} shadow-md p-8 flex flex-col items-center`}>
                        {analysisResults.referees.main.photo && (
                          <img src={`data:image/png;base64,${analysisResults.referees.main.photo}`} alt="Ana Hakem" className="w-20 h-20 rounded-full mb-4 border-4 border-green-400 shadow-lg" />
                        )}
                        <h3 className="text-2xl font-extrabold text-green-200 mb-2 font-sans tracking-tight">{analysisResults.referees.main.name || "Ana Hakem"}</h3>
                        <div className="text-base text-green-100 space-y-1 text-center font-mono">
                          <div dangerouslySetInnerHTML={{ __html: analysisResults.referees.main.info }} />
                        </div>
                      </div>
                    )}
                    {/* Yan Hakem */}
                    {analysisResults.referees.side && (
                      <div className={`${BG_CARD} rounded-lg border ${BORDER_CARD} shadow-md p-8 flex flex-col items-center`}>
                        {analysisResults.referees.side.photo && (
                          <img src={`data:image/png;base64,${analysisResults.referees.side.photo}`} alt="Yan Hakem" className="w-20 h-20 rounded-full mb-4 border-4 border-yellow-400 shadow-lg" />
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
                <div className={`${BG_CARD} rounded-lg border ${BORDER_CARD} shadow-md p-8 mb-8`}>
                  <h3 className="text-2xl font-extrabold text-center text-amber-400 mb-6 flex items-center gap-2 drop-shadow-lg">
                    <span className="text-2xl">⚽</span> İki Takım Arası Son Maçlar
                  </h3>
                  <div className="space-y-3">
                    {analysisResults.head_to_head.map((match, idx) => (
                      <div key={idx} className="flex justify-between items-center px-6 py-3 bg-zinc-900 rounded-lg font-mono text-lg font-semibold text-amber-100 shadow hover:bg-amber-500/10 transition-all">
                        <span>{match.guest_team}</span>
                        <span className="text-amber-300 font-bold">{match.result}</span>
                        <span>{match.home_team}</span>
                        <span className="text-amber-200 text-sm">{match.date}</span>
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
                  <div className="mt-6 p-4 bg-zinc-900 rounded-lg border border-zinc-700">
                    <h3 className="text-xl font-bold text-center text-green-400 mb-2 font-sans">🤖 Maç Sonucu Tahmini</h3>
                    {prediction
                      ? <p className="text-center text-white text-2xl font-mono">{prediction}</p>
                      : <p className="text-center text-zinc-400">Butona basın, tahmin gelsin</p>
                    }
                  </div>
                  <div className="flex justify-center mt-4">
                    <button
                      onClick={handleAnalysis}
                      className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-lg shadow"
                    >
                      Analiz yap
                    </button>
                  </div>
                  {showAnalysis && analysisResults && (
                    <div className="grid md:grid-cols-4 gap-8 mt-8">
                      {/* Takım A Analizi */}
                      <div className={`${BG_CARD} rounded-lg border ${BORDER_CARD} shadow-md p-6`}>
                        <h3 className="text-2xl font-extrabold text-center text-blue-200 mb-6">{analysisResults.teams.team_a.name} Analizi</h3>
                        <div className="text-blue-100 text-base font-mono space-y-6 text-center">
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-blue-300">Kaybettiği Maç</span>
                            <span className="bg-blue-800/40 px-3 py-1 mt-1 rounded-lg font-bold">{analysisResults.teams.team_a.stats.losses} / 5</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-blue-300">Berabere</span>
                            <span className="bg-blue-800/40 px-3 py-1 mt-1 rounded-lg font-bold">{analysisResults.teams.team_a.stats.draws} / 5</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-blue-300">Kazandığı Maç</span>
                            <span className="bg-blue-800/40 px-3 py-1 mt-1 rounded-lg font-bold">{analysisResults.teams.team_a.stats.wins} / 5</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-blue-300">2.5 Üst</span>
                            <span className="bg-blue-800/40 px-3 py-1 mt-1 rounded-lg font-bold">{analysisResults.teams.team_a.performance_analysis.over_2_5_count} / 5</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-blue-300">Handikaplı Galibiyet</span>
                            <span className="bg-blue-800/40 px-3 py-1 mt-1 rounded-lg font-bold">{analysisResults.teams.team_a.performance_analysis.handicap_win_count} / 5</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-blue-300">Karşılıklı Gol</span>
                            <span className="bg-blue-800/40 px-3 py-1 mt-1 rounded-lg font-bold">{analysisResults.teams.team_a.performance_analysis.both_teams_scored_count} / 5</span>
                          </div>
                        </div>
                      </div>
                      {/* Takım B Analizi */}
                      <div className={`${BG_CARD} rounded-lg border ${BORDER_CARD} shadow-md p-6`}>
                        <h3 className="text-2xl font-extrabold text-center text-amber-200 mb-6">{analysisResults.teams.team_b.name} Analizi</h3>
                        <div className="text-amber-100 text-base font-mono space-y-6 text-center">
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-amber-300">Kaybettiği Maç</span>
                            <span className="bg-amber-800/40 px-3 py-1 mt-1 rounded-lg font-bold">{analysisResults.teams.team_b.stats.losses} / 5</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-amber-300">Berabere</span>
                            <span className="bg-amber-800/40 px-3 py-1 mt-1 rounded-lg font-bold">{analysisResults.teams.team_b.stats.draws} / 5</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-amber-300">Kazandığı Maç</span>
                            <span className="bg-amber-800/40 px-3 py-1 mt-1 rounded-lg font-bold">{analysisResults.teams.team_b.stats.wins} / 5</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-amber-300">2.5 Üst</span>
                            <span className="bg-amber-800/40 px-3 py-1 mt-1 rounded-lg font-bold">{analysisResults.teams.team_b.performance_analysis.over_2_5_count} / 5</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-amber-300">Handikaplı Galibiyet</span>
                            <span className="bg-amber-800/40 px-3 py-1 mt-1 rounded-lg font-bold">{analysisResults.teams.team_b.performance_analysis.handicap_win_count} / 5</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-amber-300">Karşılıklı Gol</span>
                            <span className="bg-amber-800/40 px-3 py-1 mt-1 rounded-lg font-bold">{analysisResults.teams.team_b.performance_analysis.both_teams_scored_count} / 5</span>
                          </div>
                        </div>
                      </div>
                      {/* Aralarındaki Maçlar Analizi */}
                      <div className={`${BG_CARD} rounded-lg border ${BORDER_CARD} shadow-md p-6`}>
                        <h3 className="text-2xl font-extrabold text-center text-amber-400 mb-6">Aralarındaki Maçlar Analizi</h3>
                        <div className="text-amber-100 text-base font-mono space-y-6 text-center">
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-amber-300">Karşılıklı Gol</span>
                            <span className="bg-amber-800/40 px-3 py-1 mt-1 rounded-lg font-bold">{(analysisResults.head_to_head || []).filter(m => {const parts = (m.result || '').split(':');return parts.length === 2 && parseInt(parts[0]) > 0 && parseInt(parts[1]) > 0;}).length} / {(analysisResults.head_to_head || []).length}</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-amber-300">2.5 Üst</span>
                            <span className="bg-amber-800/40 px-3 py-1 mt-1 rounded-lg font-bold">{(analysisResults.head_to_head || []).filter(m => {const parts = (m.result || '').split(':');return parts.length === 2 && (parseInt(parts[0]) + parseInt(parts[1]) > 2);}).length} / {(analysisResults.head_to_head || []).length}</span>
                          </div>
                        </div>
                      </div>
                      {/* Hakem Analizi */}
                      <div className={`${BG_CARD} rounded-lg border ${BORDER_CARD} shadow-md p-6`}>
                        <h3 className="text-2xl font-extrabold text-center text-green-200 mb-6">Hakem Analizi</h3>
                        <div className="text-green-100 text-base font-mono space-y-6 text-center">
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-green-300">Maç Başı Sarı Kart</span>
                            <span className="bg-green-800/40 px-3 py-1 mt-1 rounded-lg font-bold">{analysisResults.referees.main?.referee_analysis?.avg_yellow ?? '-'}</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-green-300">Maç Başı Penaltı</span>
                            <span className="bg-green-800/40 px-3 py-1 mt-1 rounded-lg font-bold">{analysisResults.referees.main?.referee_analysis?.avg_penalty ?? '-'}</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-green-300">Maç Başı Kırmızı Kart</span>
                            <span className="bg-green-800/40 px-3 py-1 mt-1 rounded-lg font-bold">{analysisResults.referees.main?.referee_analysis?.avg_red ?? '-'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
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
      <style jsx>{`
        .modern-card {
          border-radius: 1.5rem;
          box-shadow: 0 8px 32px 0 rgba(0,0,0,0.25);
          padding: 2rem;
          backdrop-filter: blur(8px);
          transition: all 0.3s;
          border-width: 4px;
          position: relative;
          overflow: hidden;
        }
        .bg-cyan-gradient {
          background: linear-gradient(135deg, #164e63 0%, #0891b2 100%) !important;
        }
        .bg-purple-gradient {
          background: linear-gradient(135deg, #581c87 0%, #a21caf 100%) !important;
        }
        .bg-amber-gradient {
          background: linear-gradient(135deg, #78350f 0%, #f59e42 100%) !important;
        }
        .bg-green-gradient {
          background: linear-gradient(135deg, #14532d 0%, #22c55e 100%) !important;
        }
        .modern-card:hover {
          transform: scale(1.04);
          box-shadow: 0 8px 32px 0 rgba(0,0,0,0.35), 0 0 0 4px var(--tw-border-opacity,1);
          z-index: 2;
        }
        .animate-border-cyan {
          border-image: linear-gradient(90deg, #06b6d4, #3b82f6, #06b6d4) 1;
          animation: borderMoveCyan 3s linear infinite;
        }
        .animate-border-purple {
          border-image: linear-gradient(90deg, #a21caf, #6366f1, #a21caf) 1;
          animation: borderMovePurple 3s linear infinite;
        }
        .animate-border-amber {
          border-image: linear-gradient(90deg, #f59e42, #fbbf24, #f59e42) 1;
          animation: borderMoveAmber 3s linear infinite;
        }
        .animate-border-green {
          border-image: linear-gradient(90deg, #22c55e, #10b981, #22c55e) 1;
          animation: borderMoveGreen 3s linear infinite;
        }
        @keyframes borderMoveCyan {
          0% { border-image-source: linear-gradient(90deg, #06b6d4, #3b82f6, #06b6d4);}
          100% { border-image-source: linear-gradient(270deg, #06b6d4, #3b82f6, #06b6d4);}
        }
        @keyframes borderMovePurple {
          0% { border-image-source: linear-gradient(90deg, #a21caf, #6366f1, #a21caf);}
          100% { border-image-source: linear-gradient(270deg, #a21caf, #6366f1, #a21caf);}
        }
        @keyframes borderMoveAmber {
          0% { border-image-source: linear-gradient(90deg, #f59e42, #fbbf24, #f59e42);}
          100% { border-image-source: linear-gradient(270deg, #f59e42, #fbbf24, #f59e42);}
        }
        @keyframes borderMoveGreen {
          0% { border-image-source: linear-gradient(90deg, #22c55e, #10b981, #22c55e);}
          100% { border-image-source: linear-gradient(270deg, #22c55e, #10b981, #22c55e);}
        }
      `}</style>
    </div>
  );
};

export default Home;