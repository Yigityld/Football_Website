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



    // — Tahmin butonuna tıklanınca çalışacak (QUEUE API)
    const handlePredict = async () => {
      if (!formData.teamA || !formData.teamB) return;
      setPredicting(true);
      setPrediction('');
      try {
        // Benzersiz session hash üret
        const session_hash = 'sess-' + Math.random().toString(36).substring(2, 10);
        const fn_index = 0; // app.py'de tek fonksiyon var, genellikle 0 olur
        const trigger_id = 0;
        const join_url = 'https://husodu73-llmff.hf.space/gradio_api/queue/join';
        const data_url = 'https://husodu73-llmff.hf.space/gradio_api/queue/data';
        const prompt = `Predict the next match score between ${formData.teamA} and ${formData.teamB} in the format: Prediction: ${formData.teamA} X–Y ${formData.teamB}`;
        // 1. queue/join'a POST at
        const joinRes = await fetch(join_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data: [prompt],
            event_data: null,
            fn_index,
            trigger_id,
            session_hash
          })
        });
        if (!joinRes.ok) throw new Error('queue/join failed: ' + joinRes.status);
        const joinJson = await joinRes.json();
        const event_id = joinJson.event_id;
        if (!event_id) throw new Error('event_id alınamadı: ' + JSON.stringify(joinJson));
        // 2. queue/data'ya polling ile GET at
        let result = null;
        for (let i = 0; i < 60; i++) { // 60 sn boyunca dene
          await new Promise(res => setTimeout(res, 1000));
          const pollUrl = `${data_url}?session_hash=${session_hash}&event_id=${event_id}`;
          const pollRes = await fetch(pollUrl);
          if (!pollRes.ok) continue;
          const pollJson = await pollRes.json();
          if (pollJson && Array.isArray(pollJson.data)) {
            result = pollJson.data[0];
            break;
          }
          if (pollJson.status === 'generating') continue;
          if (pollJson.status === 'error') {
            result = '[ERROR] ' + (pollJson.message || 'queue/data error');
            break;
          }
        }
        setPrediction(result ?? 'Tahmin alınamadı');
      } catch (err) {
        console.error('Predict error:', err);
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
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
                  <div className="relative bg-black/40 backdrop-blur-sm rounded-2xl p-6 border border-orange-500/50 hover:border-orange-400/70 transition-all duration-300">
                    <div className="flex items-center mb-4">
                      <div className="w-8 h-8 bg-gradient-to-r from-orange-400 to-red-500 rounded-full flex items-center justify-center mr-3">
                        <span className="text-white font-bold">A</span>
                      </div>
                      <h3 className="text-xl font-bold text-orange-300">Takım A</h3>
                    </div>

                    <div className="space-y-4">
                      <label className="block text-sm font-medium text-orange-200 mb-2"></label>
                      <input
                        type="text"
                        name="teamA"
                        value={formData.teamA}
                        onChange={handleInputChange}
                        placeholder="Takım A adını girin..."
                        className="w-full px-4 py-3 bg-black/50 border border-orange-500/50 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/30 transition-all duration-300"
                      />
                    </div>
                  </div>
                </div>

                {/* Team B Card */}
                <div className="group relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
                  <div className="relative bg-black/40 backdrop-blur-sm rounded-2xl p-6 border border-orange-500/50 hover:border-orange-400/70 transition-all duration-300">
                    <div className="flex items-center mb-4">
                      <div className="w-8 h-8 bg-gradient-to-r from-orange-400 to-red-500 rounded-full flex items-center justify-center mr-3">
                        <span className="text-white font-bold">B</span>
                      </div>
                      <h3 className="text-xl font-bold text-orange-300">Takım B</h3>
                    </div>

                    <div className="space-y-4">
                      <label className="block text-sm font-medium text-orange-200 mb-2"></label>
                      <input
                        type="text"
                        name="teamB"
                        value={formData.teamB}
                        onChange={handleInputChange}
                        placeholder="Takım B adını girin..."
                        className="w-full px-4 py-3 bg-black/50 border border-orange-500/50 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/30 transition-all duration-300"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Referees Section with Enhanced Cards */}
              <div className="grid md:grid-cols-2 gap-8">
                {/* Main Referee Card */}
                <div className="group relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
                  <div className="relative bg-black/40 backdrop-blur-sm rounded-2xl p-6 border border-orange-500/50 hover:border-orange-400/70 transition-all duration-300">
                    <div className="flex items-center mb-4">
                      <div className="w-8 h-8 bg-gradient-to-r from-orange-400 to-red-500 rounded-full flex items-center justify-center mr-3">
                        <span className="text-white font-bold">👨‍⚖</span>
                      </div>
                      <h3 className="text-xl font-bold text-orange-300">Ana Hakem</h3>
                    </div>

                    <input
                      type="text"
                      name="mainRef"
                      value={formData.mainRef}
                      onChange={handleInputChange}
                      placeholder="Ana hakem adını girin..."
                      className="w-full px-4 py-3 bg-black/50 border border-orange-500/50 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/30 transition-all duration-300"
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
                <div className="bg-gradient-to-br from-orange-500/80 to-red-500/80 border-2 border-orange-400 rounded-2xl shadow-lg p-8 text-white relative overflow-hidden">
                  <div className="absolute inset-0 bg-black/30 rounded-2xl pointer-events-none"></div>
                  <div className="relative z-10">
                    <div className="flex items-center mb-6">
                      {analysisResults.teams.team_a.logo && (
                        <img
                          src={`data:image/png;base64,${analysisResults.teams.team_a.logo}`}
                          alt="Team A Logo"
                          className="w-16 h-16 rounded-full mr-4 border-4 border-white shadow-lg"
                        />
                      )}
                      <h3 className="text-3xl font-extrabold tracking-tight drop-shadow-lg">{analysisResults.teams.team_a.name}</h3>
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
                            <span className="text-xs text-cyan-300 ml-2">{match.dizilis || ''}</span>
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
                </div>

                {/* Team B */}
                <div className="bg-gradient-to-br from-orange-500/80 to-red-500/80 border-2 border-orange-400 rounded-2xl shadow-lg p-8 text-white relative overflow-hidden">
                  <div className="absolute inset-0 bg-black/30 rounded-2xl pointer-events-none"></div>
                  <div className="relative z-10">
                    <div className="flex items-center mb-6">
                      {analysisResults.teams.team_b.logo && (
                        <img
                          src={`data:image/png;base64,${analysisResults.teams.team_b.logo}`}
                          alt="Team B Logo"
                          className="w-16 h-16 rounded-full mr-4 border-4 border-white shadow-lg"
                        />
                      )}
                      <h3 className="text-3xl font-extrabold tracking-tight drop-shadow-lg">{analysisResults.teams.team_b.name}</h3>
                    </div>

                    <div className="space-y-2 text-base text-cyan-100 mb-6">
                      <div><span className="font-bold text-cyan-300">Lig:</span> {analysisResults.teams.team_b.info.Lig || 'Bilinmiyor'}</div>
                      <div><span className="font-bold text-cyan-300">Sıralama:</span> {analysisResults.teams.team_b.info['Lig Sıralaması'] || '?'}</div>
                      <div><span className="font-bold text-cyan-300">Kadro Değeri:</span> {analysisResults.teams.team_b.info['Kadro Değeri'] || 'Bilinmiyor'}</div>
                      <div><span className="font-bold text-cyan-300">Yaş Ortalaması:</span> {analysisResults.teams.team_b.info['Yaş Ortalaması'] || 'Bilinmiyor'}</div>
                    </div>

                    <div className="bg-gradient-to-br from-cyan-800/60 to-cyan-600/40 rounded-2xl shadow-lg p-6 backdrop-blur-md border border-cyan-400/20">
                      <h4 className="text-cyan-200 text-xl font-extrabold mb-4 flex items-center gap-2">
                        <span className="material-icons text-2xl">sports_soccer</span>
                        Son 5 Maç
                      </h4>
                      <div className="space-y-3">
                        {analysisResults.teams.team_b.last_matches.map((match, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between px-3 py-2 rounded-xl transition-all duration-200 hover:bg-cyan-400/10"
                          >
                            <span className="font-semibold text-cyan-100">{match.rakip}</span>
                            <span className="font-mono text-lg font-bold text-cyan-200">{match.sonuc}</span>
                            <span className="text-xs text-cyan-300 ml-2">{match.dizilis || ''}</span>
                            <span className="text-2xl">
                              {match.emoji === '✅' ? '✔️' : match.emoji === '❌' ? '❌' : '➖'}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 flex justify-between text-sm text-cyan-300 font-medium">
                        <span>Galibiyet: {analysisResults.teams.team_b.stats.wins}</span>
                        <span>Beraberlik: {analysisResults.teams.team_b.stats.draws}</span>
                        <span>Mağlubiyet: {analysisResults.teams.team_b.stats.losses}</span>
                      </div>
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
                      <div className="bg-gradient-to-br from-orange-500/80 to-red-500/80 border-2 border-orange-400 rounded-2xl shadow-lg p-8 text-white relative overflow-hidden flex flex-col items-center">
                        <div className="absolute inset-0 bg-black/30 rounded-2xl pointer-events-none"></div>
                        <div className="relative z-10 flex flex-col items-center w-full">
                          {analysisResults.referees.main.photo && (
                            <img src={`data:image/png;base64,${analysisResults.referees.main.photo}`} alt="Ana Hakem" className="w-20 h-20 rounded-full mb-4 border-4 border-white shadow-lg" />
                          )}
                          <h3 className="text-2xl font-extrabold mb-2 font-sans tracking-tight drop-shadow-lg">{analysisResults.referees.main.name || "Ana Hakem"}</h3>
                          <div className="text-base text-cyan-100 space-y-1 text-center font-mono w-full">
                            <div dangerouslySetInnerHTML={{ __html: analysisResults.referees.main.info }} />
                          </div>
                        </div>
                      </div>
                    )}
                    {/* Yan Hakem */}
                    {analysisResults.referees.side && (
                      <div className="bg-gradient-to-br from-orange-500/80 to-red-500/80 border-2 border-orange-400 rounded-2xl shadow-lg p-8 text-white relative overflow-hidden flex flex-col items-center">
                        <div className="absolute inset-0 bg-black/30 rounded-2xl pointer-events-none"></div>
                        <div className="relative z-10 flex flex-col items-center w-full">
                          {analysisResults.referees.side.photo && (
                            <img src={`data:image/png;base64,${analysisResults.referees.side.photo}`} alt="Yan Hakem" className="w-20 h-20 rounded-full mb-4 border-4 border-white shadow-lg" />
                          )}
                          <h3 className="text-2xl font-extrabold mb-2 font-sans tracking-tight drop-shadow-lg">{analysisResults.referees.side.name || "Yan Hakem"}</h3>
                          <div className="text-base text-cyan-100 space-y-1 text-center font-mono w-full">
                            <div dangerouslySetInnerHTML={{ __html: analysisResults.referees.side.info }} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Head to Head Matches */}
              {analysisResults && analysisResults.head_to_head && analysisResults.head_to_head.length > 0 && (
                <>
                  <div className="w-full flex justify-center mb-4">
                    <div className="bg-gradient-to-br from-orange-500/20 to-red-500/20 border-2 border-orange-400 rounded-2xl shadow-lg p-8 text-white max-w-3xl w-full relative">
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
                    </div>
                  </div>
                  <div className="w-full flex justify-center mb-4">
                    <button
                      onClick={handlePredict}
                      disabled={predicting || analysisStatus !== 'completed'}
                      className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 font-bold text-lg shadow"
                    >
                      {predicting ? 'Tahmin Yapılıyor…' : 'Gpt ile Tahmin Et'}
                    </button>
                  </div>
                </>
              )}

              {/* Prediction Section */}
              <div className="mt-6 p-4 bg-white/10 rounded-xl border border-white/20">
                <h3 className="text-xl font-bold text-center text-green-300 mb-2 font-sans">
                  🤖 Maç Sonucu Tahmini
                </h3>
                {prediction
                  ? <p className="text-center text-white text-2xl font-mono">{prediction}</p>
                  : <p className="text-center text-gray-400">Butona basın, tahmin gelsin</p>
                }
              </div>

              {/* Analysis Button */}
              <div className="flex justify-center mt-4">
                <button
                  onClick={handleAnalysis}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-lg shadow"
                >
                  Analiz yap
                </button>
              </div>

              {showAnalysis && analysisResults && (
                <div className="grid md:grid-cols-4 gap-8 mt-8">
                    {/* Takım A Analizi */}
                    <div className="bg-gradient-to-br from-orange-500/80 to-red-500/80 border-2 border-orange-400 rounded-2xl shadow-lg p-6 flex flex-col justify-between min-h-[420px] text-white relative overflow-hidden">
                      <div className="absolute inset-0 bg-black/30 rounded-2xl pointer-events-none"></div>
                      <div className="relative z-10 flex flex-col h-full">
                        <h3 className="text-2xl font-bold text-center text-orange-400 mb-6">{analysisResults.teams.team_a.name} Analizi</h3>
                        <div className="text-neutral-200 text-base font-mono space-y-6 text-center flex-1 flex flex-col justify-center">
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-cyan-300">Kaybettiği Maç</span>
                            <span className="bg-cyan-800/40 px-3 py-1 mt-1 rounded-lg font-bold">
                              {analysisResults.teams.team_a.stats.losses} / 5
                            </span>
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-cyan-300">Berabere</span>
                            <span className="bg-cyan-800/40 px-3 py-1 mt-1 rounded-lg font-bold">
                              {analysisResults.teams.team_a.stats.draws} / 5
                            </span>
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-cyan-300">Kazandığı Maç</span>
                            <span className="bg-cyan-800/40 px-3 py-1 mt-1 rounded-lg font-bold">
                              {analysisResults.teams.team_a.stats.wins} / 5
                            </span>
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-cyan-300">2.5 Üst</span>
                            <span className="bg-cyan-800/40 px-3 py-1 mt-1 rounded-lg font-bold">
                              {analysisResults.teams.team_a.performance_analysis.over_2_5_count} / 5
                            </span>
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-cyan-300">Handikaplı Galibiyet</span>
                            <span className="bg-cyan-800/40 px-3 py-1 mt-1 rounded-lg font-bold">
                              {analysisResults.teams.team_a.performance_analysis.handicap_win_count} / 5
                            </span>
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-cyan-300">Karşılıklı Gol</span>
                            <span className="bg-cyan-800/40 px-3 py-1 mt-1 rounded-lg font-bold">
                              {analysisResults.teams.team_a.performance_analysis.both_teams_scored_count} / 5
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Takım B Analizi */}
                    <div className="bg-gradient-to-br from-orange-500/80 to-red-500/80 border-2 border-orange-400 rounded-2xl shadow-lg p-6 flex flex-col justify-between min-h-[420px] text-white relative overflow-hidden">
                      <div className="absolute inset-0 bg-black/30 rounded-2xl pointer-events-none"></div>
                      <div className="relative z-10 flex flex-col h-full">
                        <h3 className="text-2xl font-bold text-center text-orange-400 mb-6">{analysisResults.teams.team_b.name} Analizi</h3>
                        <div className="text-neutral-200 text-base font-mono space-y-6 text-center flex-1 flex flex-col justify-center">
                          {/* Kaybettiği Maç */}
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-purple-300">Kaybettiği Maç</span>
                            <span className="bg-purple-800/40 px-3 py-1 mt-1 rounded-lg font-bold">
                              {analysisResults.teams.team_b.stats.losses} / 5
                            </span>
                          </div>

                          {/* Berabere */}
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-purple-300">Berabere</span>
                            <span className="bg-purple-800/40 px-3 py-1 mt-1 rounded-lg font-bold">
                              {analysisResults.teams.team_b.stats.draws} / 5
                            </span>
                          </div>

                          {/* Kazandığı Maç */}
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-purple-300">Kazandığı Maç</span>
                            <span className="bg-purple-800/40 px-3 py-1 mt-1 rounded-lg font-bold">
                              {analysisResults.teams.team_b.stats.wins} / 5
                            </span>
                          </div>

                          {/* 2.5 Üst */}
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-purple-300">2.5 Üst</span>
                            <span className="bg-purple-800/40 px-3 py-1 mt-1 rounded-lg font-bold">
                              {analysisResults.teams.team_b.performance_analysis.over_2_5_count} / 5
                            </span>
                          </div>

                          {/* Handikaplı Galibiyet */}
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-purple-300">Handikaplı Galibiyet</span>
                            <span className="bg-purple-800/40 px-3 py-1 mt-1 rounded-lg font-bold">
                              {analysisResults.teams.team_b.performance_analysis.handicap_win_count} / 5
                            </span>
                          </div>

                          {/* Karşılıklı Gol */}
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-purple-300">Karşılıklı Gol</span>
                            <span className="bg-purple-800/40 px-3 py-1 mt-1 rounded-lg font-bold">
                              {analysisResults.teams.team_b.performance_analysis.both_teams_scored_count} / 5
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Aralarındaki Maçlar Analizi */}
                    <div className="bg-gradient-to-br from-orange-500/80 to-red-500/80 border-2 border-orange-400 rounded-2xl shadow-lg p-6 flex flex-col justify-between min-h-[420px] text-white relative overflow-hidden">
                      <div className="absolute inset-0 bg-black/30 rounded-2xl pointer-events-none"></div>
                      <div className="relative z-10 flex flex-col h-full">
                        <h3 className="text-2xl font-bold text-center text-orange-400 mb-6">Aralarındaki Maçlar Analizi</h3>
                        <div className="text-neutral-200 text-base font-mono space-y-6 text-center flex-1 flex flex-col justify-center">
                          {/* Karşılıklı Gol */}
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-yellow-300">Karşılıklı Gol</span>
                            <span className="bg-yellow-800/40 px-3 py-1 mt-1 rounded-lg font-bold">
                              {
                                (analysisResults.head_to_head || []).filter(m => {
                                  const parts = (m.result || '').split(':');
                                  return parts.length === 2 && parseInt(parts[0]) > 0 && parseInt(parts[1]) > 0;
                                }).length
                              } / {(analysisResults.head_to_head || []).length}
                            </span>
                          </div>

                          {/* 2.5 Üst */}
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-yellow-300">2.5 Üst</span>
                            <span className="bg-yellow-800/40 px-3 py-1 mt-1 rounded-lg font-bold">
                              {
                                (analysisResults.head_to_head || []).filter(m => {
                                  const parts = (m.result || '').split(':');
                                  return parts.length === 2 && (parseInt(parts[0]) + parseInt(parts[1]) > 2);
                                }).length
                              } / {(analysisResults.head_to_head || []).length}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Hakem Analizi */}
                    <div className="bg-gradient-to-br from-orange-500/80 to-red-500/80 border-2 border-orange-400 rounded-2xl shadow-lg p-6 flex flex-col justify-between min-h-[420px] text-white relative overflow-hidden">
                      <div className="absolute inset-0 bg-black/30 rounded-2xl pointer-events-none"></div>
                      <div className="relative z-10 flex flex-col h-full">
                        <h3 className="text-2xl font-bold text-center text-orange-400 mb-6">Hakem Analizi</h3>
                        <div className="text-neutral-200 text-base font-mono space-y-6 text-center flex-1 flex flex-col justify-center">
                          {/* Sarı Kart */}
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-green-300">Maç Başı Sarı Kart</span>
                            <span className="bg-green-800/40 px-3 py-1 mt-1 rounded-lg font-bold">
                              {analysisResults.referees.main?.referee_analysis?.avg_yellow ?? '-'}
                            </span>
                          </div>

                          {/* Penaltı */}
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-green-300">Maç Başı Penaltı</span>
                            <span className="bg-green-800/40 px-3 py-1 mt-1 rounded-lg font-bold">
                              {analysisResults.referees.main?.referee_analysis?.avg_penalty ?? '-'}
                            </span>
                          </div>

                          {/* Kırmızı Kart */}
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-green-300">Maç Başı Kırmızı Kart</span>
                            <span className="bg-green-800/40 px-3 py-1 mt-1 rounded-lg font-bold">
                              {analysisResults.referees.main?.referee_analysis?.avg_red ?? '-'}
                            </span>
                          </div>
                        </div>
                      </div>
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