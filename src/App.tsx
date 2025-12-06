import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { CheckCircle, Calendar, User, List } from 'lucide-react';
import { getHistory, addHistoryEntry, getCleaningIndex, setCleaningIndex as fbSetCleaningIndex } from './firebase';

// Lista de moradores
const MEMBERS = ["Higor", "Mailson", "Senna", "Daniel"];

function App() {
  // Estado para saber quem é a vez (índice do array)
  // Tenta ler do localStorage, se não tiver, começa do 0 (Higor)
  const [currentIndex, setCurrentIndex] = useState(() => {
    const saved = localStorage.getItem('cleaningIndex');
    return saved ? parseInt(saved) : 0;
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  
    // Tipo para um registro de limpeza
    type HistoryEntry = {
      user: string;
      dateISO: string;
      display: string;
    };

    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [showPostConfirm, setShowPostConfirm] = useState(false);
    const postConfirmMessage = 'Por favor, envie imediatamente uma foto no grupo do quarto 40, se não enviar é viado.';

  // Persistir índice localmente e no Firestore quando mudar
  useEffect(() => {
    localStorage.setItem('cleaningIndex', currentIndex.toString());
    fbSetCleaningIndex(currentIndex).catch((e) => console.warn('Falha ao salvar índice no Firestore', e));
  }, [currentIndex]);

  // Ao montar, buscar o índice e histórico do Firestore
  useEffect(() => {
    (async () => {
      try {
        const idx = await getCleaningIndex();
        if (typeof idx === 'number') setCurrentIndex(idx);
      } catch (e) {
        console.warn('Não foi possível obter índice do Firestore', e);
      }

      try {
        const remote = await getHistory();
        // remote comes sorted desc by createdAt; map to our HistoryEntry
        setHistory(remote.map((r: any) => ({ user: r.user, dateISO: r.dateISO, display: r.display })));
      } catch (e) {
        console.warn('Não foi possível obter histórico do Firestore', e);
      }
    })();
  }, []);

  const currentUser = MEMBERS[currentIndex];

  // Gera uma foto baseada nas iniciais do nome (API gratuita)
  const avatarUrl = `https://ui-avatars.com/api/?name=${currentUser}&background=6366f1&color=fff&size=256&bold=true`;

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
      await addHistoryEntry(entry);
      setHistory((prev) => [...prev, entry]);
    } catch (e) {
      console.error('Falha ao salvar no Firestore, salvando localmente', e);
      // Use functional update and write localStorage from the same update to avoid stale state
      setHistory((prev) => {
        const next = [...prev, entry];
        try {
          localStorage.setItem('cleaningHistory', JSON.stringify(next));
        } catch (err) {
          console.error('Falha ao salvar localmente', err);
        }
        return next;
      });
    }

    // Passa para a próxima pessoa
    setCurrentIndex((prev) => (prev + 1) % MEMBERS.length);

    // Fecha o modal
    setIsModalOpen(false);
    // Mostrar mensagem pós-confirmação
    setShowPostConfirm(true);
  };
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      {/* Card Principal */}
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all hover:scale-[1.01]">
        
        {/* Cabeçalho do Card */}
        <div className="bg-indigo-600 h-32 relative">
          <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2">
            <div className="p-1 bg-white rounded-full shadow-lg">
              <img 
                src={avatarUrl} 
                alt={currentUser} 
                className="w-24 h-24 rounded-full object-cover border-4 border-white"
              />
            </div>
          </div>
        </div>

        {/* Conteúdo do Card */}
        <div className="pt-16 pb-8 px-8 text-center">
          <h2 className="text-gray-500 text-sm font-semibold uppercase tracking-wide mb-1">
            Vez da limpeza
          </h2>
          <h1 className="text-3xl font-bold text-gray-800 mb-6">
            {currentUser}
          </h1>

          <div className="bg-indigo-50 rounded-xl p-4 mb-6 text-indigo-700 text-sm flex items-center justify-center gap-2">
            <User size={18} />
            <span>Mantenha o quarto organizado!</span>
          </div>

          <button 
            onClick={() => setIsModalOpen(true)}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 group"
          >
            <CheckCircle className="group-hover:scale-110 transition-transform" />
            Já Limpei
          </button>
          <button onClick={() => setIsHistoryOpen(true)}
            className="w-full mt-3 bg-white border border-gray-200 text-gray-700 py-3 rounded-xl hover:bg-gray-50 flex items-center justify-center gap-2">
            <List size={16} />
            Histórico ({history.length})
          </button>
        </div>
      </div>

      {/* Modal / Pop-up */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xs shadow-2xl animate-fade-in">
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Calendar className="text-indigo-600" />
              Selecionar Data
            </h3>

            
            
            
            <div className="mb-6">
              <label className="block text-sm text-gray-600 mb-2">Quando foi feito?</label>
              <DatePicker 
                selected={selectedDate} 
                onChange={(date: Date | null) => setSelectedDate(date)} 
                inline
                calendarClassName="!border-0 !shadow-none !font-sans"
              />
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="flex-1 px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleClean}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Histórico Modal */}
      {isHistoryOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-fade-in">
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <List className="text-indigo-600" />
              Histórico de Limpezas
            </h3>

            <div className="mb-4 max-h-64 overflow-auto">
              {history.length === 0 ? (
                <p className="text-sm text-gray-500">Nenhum registro ainda.</p>
              ) : (
                history
                  .slice()
                  .reverse()
                  .map((h, idx) => (
                    <div key={idx} className="py-2 border-b last:border-b-0">
                      <div className="text-sm text-gray-700 font-medium">{h.user}</div>
                      <div className="text-xs text-gray-500">{h.display}</div>
                    </div>
                  ))
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="flex-1 px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors"
              >
                Fechar
              </button>
              <button
                onClick={() => {
                  // clear local storage and local state. If you want to clear Firestore too, do it in the console.
                  localStorage.removeItem('cleaningHistory');
                  setHistory([]);
                }}
                className="flex-1 px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors"
              >
                Limpar
              </button>
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
              <button
                onClick={() => setShowPostConfirm(false)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;