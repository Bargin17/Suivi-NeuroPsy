/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  Timestamp,
  deleteDoc,
  updateDoc,
  doc
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User
} from 'firebase/auth';
import { db, auth } from './firebase';
import { 
  Plus, 
  LogOut, 
  Calendar, 
  Brain, 
  MessageSquare, 
  Activity, 
  TrendingUp, 
  Trash2,
  Edit2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Download
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Error handling types
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: any[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface NeuroEntry {
  id: string;
  uid: string;
  date: string;
  situation: string;
  functions: string;
  reaction: string;
  consequence: string;
  emotion: number;
  createdAt: string;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<NeuroEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    situation: '',
    functions: '',
    reaction: '',
    consequence: '',
    emotion: 5
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setEntries([]);
      return;
    }

    const path = 'entries';
    const q = query(
      collection(db, path),
      where('uid', '==', user.uid),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newEntries = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as NeuroEntry[];
      setEntries(newEntries);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, path);
    });

    return () => unsubscribe();
  }, [user]);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error('Login error:', err);
      setError('Erreur lors de la connexion. Veuillez réessayer.');
    }
  };

  const handleLogout = () => signOut(auth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const path = 'entries';
    try {
      if (editingId) {
        await updateDoc(doc(db, path, editingId), {
          ...formData,
          updatedAt: new Date().toISOString()
        });
      } else {
        await addDoc(collection(db, path), {
          uid: user.uid,
          ...formData,
          createdAt: new Date().toISOString()
        });
      }
      
      setFormData({
        date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        situation: '',
        functions: '',
        reaction: '',
        consequence: '',
        emotion: 5
      });
      setShowForm(false);
      setEditingId(null);
      setError(null);
    } catch (err) {
      handleFirestoreError(err, editingId ? OperationType.UPDATE : OperationType.CREATE, path);
    }
  };

  const handleEdit = (entry: NeuroEntry) => {
    setFormData({
      date: entry.date,
      situation: entry.situation,
      functions: entry.functions,
      reaction: entry.reaction,
      consequence: entry.consequence,
      emotion: entry.emotion
    });
    setEditingId(entry.id);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({
      date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      situation: '',
      functions: '',
      reaction: '',
      consequence: '',
      emotion: 5
    });
  };

  const handleDelete = (id: string) => {
    setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    const path = `entries/${deleteConfirmId}`;
    try {
      await deleteDoc(doc(db, 'entries', deleteConfirmId));
      setDeleteConfirmId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const chartData = useMemo(() => {
    return [...entries]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(entry => ({
        date: format(new Date(entry.date), 'dd/MM', { locale: fr }),
        emotion: entry.emotion,
        fullDate: format(new Date(entry.date), 'PPP', { locale: fr })
      }));
  }, [entries]);

  const handleExportPDF = () => {
    if (entries.length === 0) return;

    const doc = new jsPDF({ orientation: 'landscape' });
    
    // Add title
    doc.setFontSize(18);
    doc.text('Suivi Neuropsychologique', 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Généré le ${format(new Date(), 'PPP', { locale: fr })}`, 14, 30);

    const tableData = entries
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map(entry => [
        format(new Date(entry.date), 'dd/MM/yyyy HH:mm'),
        entry.situation,
        entry.functions,
        entry.reaction,
        entry.consequence,
        `${entry.emotion}/10`
      ]);

    autoTable(doc, {
      startY: 40,
      head: [['Date / Moment', 'Situation', 'Fonction(s)', 'Réaction', 'Conséquence', 'Émotion']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [90, 90, 64], textColor: 255 },
      styles: { fontSize: 9, cellPadding: 3, overflow: 'linebreak' },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 60 },
        2: { cellWidth: 45 },
        3: { cellWidth: 50 },
        4: { cellWidth: 50 },
        5: { cellWidth: 25, halign: 'center' }
      }
    });

    doc.save(`suivi-neuro-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F2ED] flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <Brain className="w-12 h-12 text-[#5A5A40]" />
          <p className="text-[#5A5A40] font-serif italic">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F5F2ED] flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-white rounded-[32px] p-12 shadow-sm border border-black/5">
          <Brain className="w-16 h-16 text-[#5A5A40] mx-auto mb-6" />
          <h1 className="text-4xl font-serif font-light text-[#1a1a1a] mb-4">Suivi Neuropsychologique</h1>
          <p className="text-[#5A5A40] mb-8 leading-relaxed">
            Un espace sécurisé pour documenter vos fonctions cognitives et vos émotions au quotidien.
          </p>
          <button
            onClick={handleLogin}
            className="w-full bg-[#5A5A40] text-white rounded-full py-4 px-8 font-medium hover:bg-[#4A4A30] transition-colors flex items-center justify-center gap-3"
          >
            Se connecter avec Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F2ED] text-[#1a1a1a] pb-20">
      {/* Header */}
      <header className="bg-white border-b border-black/5 sticky top-0 z-10 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#5A5A40] flex items-center justify-center">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-serif font-medium hidden sm:block">Mon Suivi Neuro</h1>
          </div>
          <div className="flex items-center gap-4">
            {entries.length > 0 && (
              <button
                onClick={handleExportPDF}
                className="p-2 text-[#5A5A40] hover:bg-[#5A5A40]/5 rounded-full transition-colors"
                title="Exporter en PDF"
              >
                <Download className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={() => setShowForm(!showForm)}
              className="bg-[#5A5A40] text-white rounded-full py-2 px-6 text-sm font-medium hover:bg-[#4A4A30] transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nouvelle entrée
            </button>
            <button
              onClick={handleLogout}
              className="p-2 text-[#5A5A40] hover:bg-[#5A5A40]/5 rounded-full transition-colors"
              title="Déconnexion"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-100 text-red-700 p-4 rounded-2xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Chart Section */}
        {entries.length > 0 && (
          <section className="bg-white rounded-[32px] p-8 shadow-sm border border-black/5">
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="w-5 h-5 text-[#5A5A40]" />
              <h2 className="text-lg font-serif font-medium">Évolution de l'émotion</h2>
            </div>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorEmotion" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#5A5A40" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#5A5A40" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 12, fill: '#888'}}
                  />
                  <YAxis 
                    domain={[0, 10]} 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 12, fill: '#888'}}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}
                    labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="emotion" 
                    stroke="#5A5A40" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorEmotion)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {/* Form Overlay */}
        {showForm && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <div className="bg-white rounded-[32px] w-full max-w-2xl max-h-[90vh] overflow-y-auto p-8 shadow-xl">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-serif font-medium">
                  {editingId ? 'Modifier l\'observation' : 'Nouvelle observation'}
                </h2>
                <button 
                  onClick={closeForm}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  <ChevronDown className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-wider font-semibold text-[#5A5A40]">Date / Moment</label>
                    <input
                      type="datetime-local"
                      required
                      value={formData.date}
                      onChange={e => setFormData({...formData, date: e.target.value})}
                      className="w-full bg-[#F5F2ED] border-none rounded-2xl p-4 focus:ring-2 focus:ring-[#5A5A40] transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-wider font-semibold text-[#5A5A40]">Émotion (0-10)</label>
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        min="0"
                        max="10"
                        value={formData.emotion}
                        onChange={e => setFormData({...formData, emotion: parseInt(e.target.value)})}
                        className="flex-1 accent-[#5A5A40]"
                      />
                      <span className="text-xl font-serif font-medium w-8">{formData.emotion}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wider font-semibold text-[#5A5A40]">Situation (brève description)</label>
                  <textarea
                    required
                    value={formData.situation}
                    onChange={e => setFormData({...formData, situation: e.target.value})}
                    placeholder="Que s'est-il passé ?"
                    className="w-full bg-[#F5F2ED] border-none rounded-2xl p-4 min-h-[100px] focus:ring-2 focus:ring-[#5A5A40] transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wider font-semibold text-[#5A5A40]">Fonction(s) impliquée(s)</label>
                  <input
                    type="text"
                    value={formData.functions}
                    onChange={e => setFormData({...formData, functions: e.target.value})}
                    placeholder="Mémoire, attention, planification..."
                    className="w-full bg-[#F5F2ED] border-none rounded-2xl p-4 focus:ring-2 focus:ring-[#5A5A40] transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-wider font-semibold text-[#5A5A40]">Réaction / Comportement</label>
                    <textarea
                      value={formData.reaction}
                      onChange={e => setFormData({...formData, reaction: e.target.value})}
                      className="w-full bg-[#F5F2ED] border-none rounded-2xl p-4 min-h-[100px] focus:ring-2 focus:ring-[#5A5A40] transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-wider font-semibold text-[#5A5A40]">Conséquence concrète</label>
                    <textarea
                      value={formData.consequence}
                      onChange={e => setFormData({...formData, consequence: e.target.value})}
                      className="w-full bg-[#F5F2ED] border-none rounded-2xl p-4 min-h-[100px] focus:ring-2 focus:ring-[#5A5A40] transition-all"
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={closeForm}
                    className="flex-1 border border-[#5A5A40] text-[#5A5A40] rounded-full py-4 font-medium hover:bg-[#5A5A40]/5 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-[#5A5A40] text-white rounded-full py-4 font-medium hover:bg-[#4A4A30] transition-colors"
                  >
                    {editingId ? 'Mettre à jour' : 'Enregistrer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Entries List */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-serif font-medium">Historique des observations</h2>
            <span className="text-sm text-[#5A5A40] font-medium bg-[#5A5A40]/10 px-4 py-1 rounded-full">
              {entries.length} entrée{entries.length > 1 ? 's' : ''}
            </span>
          </div>

          {entries.length === 0 ? (
            <div className="bg-white rounded-[32px] p-12 text-center border border-black/5">
              <Brain className="w-12 h-12 text-[#5A5A40]/20 mx-auto mb-4" />
              <p className="text-[#5A5A40] italic">Aucune observation enregistrée pour le moment.</p>
              <button
                onClick={() => setShowForm(true)}
                className="mt-6 text-[#5A5A40] font-medium underline underline-offset-4"
              >
                Commencer mon suivi
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {entries.map((entry) => (
                <article 
                  key={entry.id}
                  className="bg-white rounded-[32px] p-8 shadow-sm border border-black/5 hover:shadow-md transition-shadow group relative"
                >
                  <div className="absolute top-6 right-6 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                    <button
                      onClick={() => handleEdit(entry)}
                      className="p-2 text-[#5A5A40] hover:bg-[#5A5A40]/5 rounded-full transition-colors"
                      title="Modifier"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="p-2 text-red-400 hover:bg-red-50 rounded-full transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="flex flex-col md:flex-row md:items-start gap-6">
                    <div className="md:w-48 flex-shrink-0">
                      <div className="flex items-center gap-2 text-[#5A5A40] mb-2">
                        <Calendar className="w-4 h-4" />
                        <span className="text-sm font-semibold uppercase tracking-wider">
                          {format(new Date(entry.date), 'dd MMM yyyy', { locale: fr })}
                        </span>
                      </div>
                      <div className="text-xs text-[#5A5A40]/60">
                        {format(new Date(entry.date), 'HH:mm')}
                      </div>
                      <div className="mt-4 flex items-center gap-2">
                        <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-[#5A5A40]" 
                            style={{ width: `${entry.emotion * 10}%` }}
                          />
                        </div>
                        <span className="text-sm font-serif font-medium">{entry.emotion}/10</span>
                      </div>
                    </div>

                    <div className="flex-1 space-y-6">
                      <div>
                        <h3 className="text-xl font-serif font-medium mb-2">{entry.situation}</h3>
                        {entry.functions && (
                          <div className="flex items-center gap-2 text-[#5A5A40]">
                            <Brain className="w-4 h-4" />
                            <span className="text-sm italic">{entry.functions}</span>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-black/5">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-[#5A5A40]">
                            <Activity className="w-4 h-4" />
                            <span className="text-xs uppercase tracking-wider font-bold">Réaction</span>
                          </div>
                          <p className="text-sm leading-relaxed text-gray-600">{entry.reaction || 'Non renseigné'}</p>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-[#5A5A40]">
                            <MessageSquare className="w-4 h-4" />
                            <span className="text-xs uppercase tracking-wider font-bold">Conséquence</span>
                          </div>
                          <p className="text-sm leading-relaxed text-gray-600">{entry.consequence || 'Non renseigné'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-[32px] w-full max-w-md p-8 shadow-xl border border-black/5">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-6">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <h2 className="text-2xl font-serif font-medium mb-4">Supprimer l'entrée ?</h2>
            <p className="text-[#5A5A40] mb-8 leading-relaxed">
              Cette action est irréversible. Êtes-vous sûr de vouloir supprimer cette observation de votre historique ?
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 border border-gray-200 text-gray-600 rounded-full py-3 font-medium hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 bg-red-500 text-white rounded-full py-3 font-medium hover:bg-red-600 transition-colors"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
