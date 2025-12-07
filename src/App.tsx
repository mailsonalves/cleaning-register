import { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { CheckCircle, Calendar, User, List } from 'lucide-react';
import { getHistory, addHistoryEntry, getFirebaseDiagnostics } from './firebase';

// Lista de moradores para limpeza
const MEMBERS = ["Higor", "Mailson", "Senna", "Daniel"];
// Lista de responsáveis para compra de água (apenas os três pedidos)
const WATER_MEMBERS = ["Higor", "Senna", "Mailson"];

function App() {
  // Cleaning index (derived from history: next after last entry)
  const [currentIndex, setCurrentIndex] = useState(0);

  // Water index (derived from water history)
  const [waterIndex, setWaterIndex] = useState(0);

  // Modals e datas
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

  const [isWaterModalOpen, setIsWaterModalOpen] = useState(false);
  const [waterSelectedDate, setWaterSelectedDate] = useState<Date | null>(new Date());

  // Tipo para um registro
  type HistoryEntry = {
    user: string;
    dateISO: string;
    display: string;
  };

  // Históricos e estados de UI
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const [waterHistory, setWaterHistory] = useState<HistoryEntry[]>([]);
  const [isWaterHistoryOpen, setIsWaterHistoryOpen] = useState(false);

  const [showPostConfirm, setShowPostConfirm] = useState(false);
  const [postConfirmMessage, setPostConfirmMessage] = useState('Por favor, envie uma foto no grupo do quarto 40.');
  const [firebaseDiag, setFirebaseDiag] = useState<{ isConfigured: boolean; firestoreAvailable: boolean; authUser: any } | null>(null);

  // Nota: não persistimos mais o índice separadamente; ele é derivado do último registro do histórico.

  // Ao montar, buscar os índices e históricos do Firestore/local
  useEffect(() => {
    (async () => {
      try {
        const remote = await getHistory('cleaning');
        const cleaned = remote.map((r: any) => ({ user: r.user, dateISO: r.dateISO, display: r.display }));
        setHistory(cleaned);
        // derive next index from last (most recent) entry
        if (cleaned.length > 0) {
          const last = cleaned[0].user; // getHistory returns newest first
          const idx = MEMBERS.indexOf(last);
          setCurrentIndex(idx === -1 ? 0 : (idx + 1) % MEMBERS.length);
        }
      } catch (e) {
        console.warn('Não foi possível obter histórico de limpeza do Firestore', e);
      }

      // water
      try {
        const wRemote = await getHistory('water');
        const wCleaned = wRemote.map((r: any) => ({ user: r.user, dateISO: r.dateISO, display: r.display }));
        setWaterHistory(wCleaned);
        if (wCleaned.length > 0) {
          const last = wCleaned[0].user;
          const idx = WATER_MEMBERS.indexOf(last);
          setWaterIndex(idx === -1 ? 0 : (idx + 1) % WATER_MEMBERS.length);
        }
      } catch (e) {
        console.warn('Não foi possível obter histórico de água do Firestore', e);
      }

      // Diagnostics: read firebase status
      try {
        const d = getFirebaseDiagnostics();
        setFirebaseDiag(d as any);
      } catch {}
    })();
  }, []);

  const handleForceSync = async () => {
    try {
      // apenas recarrega históricos e diagnósticos
      const d = getFirebaseDiagnostics();
      setFirebaseDiag(d as any);
      // reload histories from source to reflect remote state
      const remote = await getHistory('cleaning');
      setHistory(remote.map((r: any) => ({ user: r.user, dateISO: r.dateISO, display: r.display })));
      const wRemote = await getHistory('water');
      setWaterHistory(wRemote.map((r: any) => ({ user: r.user, dateISO: r.dateISO, display: r.display })));
    } catch (err) {
      console.warn('Force sync failed', err);
    }
  };

  const currentUser = MEMBERS[currentIndex];
  const currentWaterUser = WATER_MEMBERS[waterIndex];

  // Avatares
  const avatarUrl = `https://ui-avatars.com/api/?name=${currentUser}&background=6366f1&color=fff&size=256&bold=true`;
  const waterAvatarUrl = `https://ui-avatars.com/api/?name=${currentWaterUser}&background=06b6d4&color=fff&size=256&bold=true`;

  const handleClean = async () => {
    const cleanedAt = selectedDate ? selectedDate : new Date();
    const cleanedISO = cleanedAt.toISOString();
    const display = cleanedAt.toLocaleString();

    const entry: HistoryEntry = {
      user: currentUser,
      dateISO: cleanedISO,
      display,
    };

    try {
      await addHistoryEntry(entry, 'cleaning');
      // manter ordem: mais novo primeiro
      setHistory((prev) => [entry, ...prev]);
    } catch (e) {
      console.error('Falha ao salvar no Firestore, salvando localmente', e);
      setHistory((prev) => {
        const next = [entry, ...prev];
        try {
          localStorage.setItem('cleaningHistory', JSON.stringify(next));
        } catch (err) {
          console.error('Falha ao salvar localmente', err);
        }
        return next;
      });
    }

    // atualizar índice atual derivado do último do histórico (novo registro)
    const lastIdx = MEMBERS.indexOf(entry.user);
    setCurrentIndex(lastIdx === -1 ? 0 : (lastIdx + 1) % MEMBERS.length);
    setIsModalOpen(false);
    setPostConfirmMessage('Registro de limpeza salvo. Obrigado!');
    setShowPostConfirm(true);

    // não mais sync de índice: índice é derivado do histórico
  };

  const handleWaterPurchase = async () => {
    const boughtAt = waterSelectedDate ? waterSelectedDate : new Date();
    const boughtISO = boughtAt.toISOString();
    const display = boughtAt.toLocaleString();

    const entry: HistoryEntry = {
      user: currentWaterUser,
      dateISO: boughtISO,
      display,
    };

    try {
      await addHistoryEntry(entry, 'water');
      setWaterHistory((prev) => [entry, ...prev]);
    } catch (e) {
      console.error('Falha ao salvar compra de água no Firestore, salvando localmente', e);
      setWaterHistory((prev) => {
        const next = [entry, ...prev];
        try {
          localStorage.setItem('waterHistory', JSON.stringify(next));
        } catch (err) {
          console.error('Falha ao salvar localmente', err);
        }
        return next;
      });
    }

    const lastWIdx = WATER_MEMBERS.indexOf(entry.user);
    setWaterIndex(lastWIdx === -1 ? 0 : (lastWIdx + 1) % WATER_MEMBERS.length);
    setIsWaterModalOpen(false);
    setPostConfirmMessage('Compra de água registrada. Obrigado!');
    setShowPostConfirm(true);

    // não mais sync de índice: índice é derivado do histórico
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-2xl flex flex-col items-center gap-6">
        {firebaseDiag && (!firebaseDiag.firestoreAvailable || !firebaseDiag.authUser) && (
          <div className="w-full bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded-md text-sm text-yellow-800">
            <div className="flex items-center justify-between gap-3">
              <div>
                { !firebaseDiag.firestoreAvailable && <div>Firebase não configurado no build (usando localStorage). Verifique variáveis no Vercel.</div> }
                { firebaseDiag.firestoreAvailable && !firebaseDiag.authUser && <div>Firestore disponível, mas sem usuário autenticado (habilite Anonymous Auth no Firebase).</div> }
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleForceSync} className="px-3 py-1 bg-yellow-400 text-white rounded text-sm">Tentar sincronizar</button>
              </div>
            </div>
          </div>
        )}
        {/* Card de Limpeza */}
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all hover:scale-[1.01]">
          <div className="bg-indigo-600 h-32 relative">
            <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2">
              <div className="p-1 bg-white rounded-full shadow-lg">
                <img src={avatarUrl} alt={currentUser} className="w-24 h-24 rounded-full object-cover border-4 border-white" />
              </div>
            </div>
          </div>
          <div className="pt-16 pb-8 px-8 text-center">
            <h2 className="text-gray-500 text-sm font-semibold uppercase tracking-wide mb-1">Vez da limpeza</h2>
            <h1 className="text-3xl font-bold text-gray-800 mb-6">{currentUser}</h1>

            <div className="bg-indigo-50 rounded-xl p-4 mb-6 text-indigo-700 text-sm flex items-center justify-center gap-2">
              <User size={18} />
              <span>Mantenha o quarto organizado!</span>
            </div>

            <button onClick={() => setIsModalOpen(true)} className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 group">
              <CheckCircle className="group-hover:scale-110 transition-transform" />
              Já Limpei
            </button>
            <button onClick={() => setIsHistoryOpen(true)} className="w-full mt-3 bg-white border border-gray-200 text-gray-700 py-3 rounded-xl hover:bg-gray-50 flex items-center justify-center gap-2">
              <List size={16} />
              Histórico ({history.length})
            </button>
          </div>
        </div>

        {/* Card de Compra de Água (abaixo) */}
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all hover:scale-[1.01]">
          <div className="bg-cyan-600 h-32 relative">
            <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2">
              <div className="p-1 bg-white rounded-full shadow-lg">
                <img src={waterAvatarUrl} alt={currentWaterUser} className="w-24 h-24 rounded-full object-cover border-4 border-white" />
              </div>
            </div>
          </div>
          <div className="pt-16 pb-8 px-8 text-center">
            <h2 className="text-gray-500 text-sm font-semibold uppercase tracking-wide mb-1">Compra de água</h2>
            <h1 className="text-3xl font-bold text-gray-800 mb-6">{currentWaterUser}</h1>

            <div className="bg-cyan-50 rounded-xl p-4 mb-6 text-cyan-700 text-sm flex items-center justify-center gap-2">
              <User size={18} />
              <span>Registrar compra de água</span>
            </div>

            <button onClick={() => setIsWaterModalOpen(true)} className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 group">
              <CheckCircle className="group-hover:scale-110 transition-transform" />
              Já Comprei Água
            </button>
            <button onClick={() => setIsWaterHistoryOpen(true)} className="w-full mt-3 bg-white border border-gray-200 text-gray-700 py-3 rounded-xl hover:bg-gray-50 flex items-center justify-center gap-2">
              <List size={16} />
              Histórico ({waterHistory.length})
            </button>
          </div>
        </div>
      </div>

      {/* Modal Limpeza */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xs shadow-2xl animate-fade-in">
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2"><Calendar className="text-indigo-600" />Selecionar Data</h3>
            <div className="mb-6">
              <label className="block text-sm text-gray-600 mb-2">Quando foi feito?</label>
              <DatePicker selected={selectedDate} onChange={(date: Date | null) => setSelectedDate(date)} inline calendarClassName="!border-0 !shadow-none !font-sans" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors">Cancelar</button>
              <button onClick={handleClean} className="flex-1 px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Água */}
      {isWaterModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xs shadow-2xl animate-fade-in">
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2"><Calendar className="text-cyan-600" />Selecionar Data</h3>
            <div className="mb-6">
              <label className="block text-sm text-gray-600 mb-2">Quando foi comprado?</label>
              <DatePicker selected={waterSelectedDate} onChange={(date: Date | null) => setWaterSelectedDate(date)} inline calendarClassName="!border-0 !shadow-none !font-sans" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setIsWaterModalOpen(false)} className="flex-1 px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors">Cancelar</button>
              <button onClick={handleWaterPurchase} className="flex-1 px-4 py-2 bg-cyan-600 text-white font-bold rounded-lg hover:bg-cyan-700 transition-colors">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* Histórico Limpeza Modal */}
      {isHistoryOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-fade-in">
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2"><List className="text-indigo-600" />Histórico de Limpezas</h3>
            <div className="mb-4 max-h-64 overflow-auto">
              {history.length === 0 ? (
                <p className="text-sm text-gray-500">Nenhum registro ainda.</p>
              ) : (
                history.slice().reverse().map((h, idx) => (
                  <div key={idx} className="py-2 border-b last:border-b-0">
                    <div className="text-sm text-gray-700 font-medium">{h.user}</div>
                    <div className="text-xs text-gray-500">{h.display}</div>
                  </div>
                ))
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setIsHistoryOpen(false)} className="flex-1 px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Histórico Água Modal */}
      {isWaterHistoryOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-fade-in">
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2"><List className="text-cyan-600" />Histórico de Compras de Água</h3>
            <div className="mb-4 max-h-64 overflow-auto">
              {waterHistory.length === 0 ? (
                <p className="text-sm text-gray-500">Nenhum registro ainda.</p>
              ) : (
                waterHistory.slice().reverse().map((h, idx) => (
                  <div key={idx} className="py-2 border-b last:border-b-0">
                    <div className="text-sm text-gray-700 font-medium">{h.user}</div>
                    <div className="text-xs text-gray-500">{h.display}</div>
                  </div>
                ))
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setIsWaterHistoryOpen(false)} className="flex-1 px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Pós-confirmação */}
      {showPostConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-fade-in">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Confirmado</h3>
            <p className="text-sm text-gray-700 mb-4">{postConfirmMessage}</p>
            <div className="flex justify-end">
              <button onClick={() => setShowPostConfirm(false)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">OK</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;