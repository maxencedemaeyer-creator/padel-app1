import { useState, useEffect, useMemo, FormEvent } from 'react';
import {
  DollarSign, Users, Calendar, CheckCircle2,
  Plus, Download, Upload, Trash2, Edit, Check, Search, ShieldAlert,
  CreditCard, UserPlus, Grid, LayoutDashboard, X, Save, Star, Trophy,
} from 'lucide-react';

// --- TYPES ---
type Federation = 'none' | 'afp' | 'aft' | 'both';

const FEDERATION_LABELS: Record<Federation, string> = {
  none: 'Aucune',
  afp: 'AFP',
  aft: 'AFT',
  both: 'AFP + AFT',
};

interface Player {
  id: string;
  name: string;
  isCreditor: boolean;
  initialCredit: number;
  isGuest: boolean;
  stars: number; // 0.5 to 5 in 0.5 steps
  federation: Federation;
}

type PlayerStatus = 'creditor-regular' | 'regular' | 'occasional';

const STATUS_LABELS: Record<PlayerStatus, string> = {
  'creditor-regular': 'Créancier-Joueur Régulier',
  'regular': 'Joueur Régulier',
  'occasional': 'Joueur Occasionnel',
};

const getStatusFromPlayer = (p: Player): PlayerStatus => {
  if (p.isCreditor) return 'creditor-regular';
  if (p.isGuest) return 'occasional';
  return 'regular';
};

// Star level legend: 0.5=P50, 1=P100, 2=P200, 3=P300, 4=P400, 5=P500
const STAR_LEVELS: { stars: number; label: string }[] = [
  { stars: 0.5, label: 'P50' },
  { stars: 1, label: 'P100' },
  { stars: 2, label: 'P200' },
  { stars: 3, label: 'P300' },
  { stars: 4, label: 'P400' },
  { stars: 5, label: 'P500' },
];

const getStarLabel = (stars: number): string => {
  const found = STAR_LEVELS.find(s => s.stars === stars);
  return found ? found.label : 'Non classé';
};

// Court slot: position on a court. Team A = positions 0,1; Team B = positions 2,3
interface CourtSlot {
  courtNumber: number; // 1 or 6
  position: number; // 0-3 (0-1 = team A, 2-3 = team B)
  playerId: string | null;
}

interface PlayerRecord {
  playerId: string;
  paid: boolean;
  paidToCreditorId: string | null;
  courtNumber: number; // 1 or 6
  team: 'A' | 'B'; // team A or B on that court
}

interface Match {
  id: string;
  number: number;
  date: string;
  players: PlayerRecord[];
}

interface PaymentInfo {
  paid: boolean;
  paidToCreditorId: string | null;
}

interface UnpaidRecord {
  matchId: string;
  matchNumber: number;
  matchDate: string;
  playerId: string;
  playerName: string;
  amount: number;
}

// --- JOUEURS PAR DÉFAUT ---
const DEFAULT_PLAYERS: Player[] = [
  { id: 'donald', name: 'Donald', isCreditor: true, initialCredit: 2000, isGuest: false, stars: 3, federation: 'afp' },
  { id: 'adrien', name: 'Adrien', isCreditor: true, initialCredit: 1300, isGuest: false, stars: 3, federation: 'aft' },
  { id: 'maxence', name: 'Maxence', isCreditor: true, initialCredit: 1300, isGuest: false, stars: 2, federation: 'both' },
  { id: 'alex', name: 'Alexandre', isCreditor: false, initialCredit: 0, isGuest: false, stars: 2, federation: 'afp' },
  { id: 'thomas', name: 'Thomas', isCreditor: false, initialCredit: 0, isGuest: false, stars: 1, federation: 'none' },
  { id: 'julien', name: 'Julien', isCreditor: false, initialCredit: 0, isGuest: false, stars: 1, federation: 'none' },
  { id: 'nicolas', name: 'Nicolas', isCreditor: false, initialCredit: 0, isGuest: false, stars: 2, federation: 'aft' },
  { id: 'maxime', name: 'Maxime', isCreditor: false, initialCredit: 0, isGuest: false, stars: 1, federation: 'none' },
  { id: 'antoine', name: 'Antoine', isCreditor: false, initialCredit: 0, isGuest: false, stars: 0.5, federation: 'none' },
  { id: 'romain', name: 'Romain', isCreditor: false, initialCredit: 0, isGuest: false, stars: 1, federation: 'none' },
  { id: 'lucas', name: 'Lucas', isCreditor: false, initialCredit: 0, isGuest: false, stars: 0.5, federation: 'none' },
  { id: 'guillaume', name: 'Guillaume', isCreditor: false, initialCredit: 0, isGuest: false, stars: 1, federation: 'none' },
  { id: 'pierre', name: 'Pierre', isCreditor: false, initialCredit: 0, isGuest: false, stars: 0.5, federation: 'none' },
];

const PRICE_PER_MATCH = 13;
const TOTAL_SEASON_MATCHES = 44;
const COURT_NUMBERS = [1, 6];

type TabId = 'dashboard' | 'entry' | 'matrix' | 'players';

// --- COMPOSANT ÉTOILES ---
function StarRating({ value, onChange, size = 'sm' }: { value: number; onChange?: (v: number) => void; size?: 'sm' | 'md' }) {
  const starSize = size === 'md' ? 'w-5 h-5' : 'w-3.5 h-3.5';
  const halfSize = size === 'md' ? 'w-2.5 h-5' : 'w-1.75 h-3.5';

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => {
        const isFull = value >= i;
        const isHalf = value >= i - 0.5 && value < i;
        return (
          <div key={i} className="relative flex items-center justify-center">
            {/* Background star */}
            <Star className={`${starSize} text-slate-600`} fill="currentColor" />
            {/* Full star overlay */}
            {isFull && (
              <Star className={`${starSize} text-amber-400 absolute`} fill="currentColor" />
            )}
            {/* Half star overlay */}
            {isHalf && (
              <div className="absolute overflow-hidden" style={{ width: '50%' }}>
                <Star className={`${starSize} text-amber-400`} fill="currentColor" />
              </div>
            )}
            {/* Click targets */}
            {onChange && (
              <>
                <button
                  type="button"
                  onClick={() => onChange(i - 0.5)}
                  className="absolute left-0 top-0 h-full"
                  style={{ width: '50%' }}
                  title={`${i - 0.5} étoile${i - 0.5 > 1 ? 's' : ''} (${getStarLabel(i - 0.5)})`}
                />
                <button
                  type="button"
                  onClick={() => onChange(i)}
                  className="absolute right-0 top-0 h-full"
                  style={{ width: '50%' }}
                  title={`${i} étoile${i > 1 ? 's' : ''} (${getStarLabel(i)})`}
                />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function PadelApp() {
  // --- ÉTATS PRINCIPAUX ---
  const [players, setPlayers] = useState<Player[]>(() => {
    const saved = localStorage.getItem('padel_players');
    if (saved) {
      const parsed = JSON.parse(saved) as Player[];
      return parsed.map(p => ({
        ...p,
        stars: p.stars ?? 0,
        federation: p.federation ?? 'none',
      }));
    }
    return DEFAULT_PLAYERS;
  });

  const [matches, setMatches] = useState<Match[]>(() => {
    const saved = localStorage.getItem('padel_matches');
    if (saved) {
      const parsed = JSON.parse(saved) as Match[];
      return parsed.map(m => ({
        ...m,
        players: m.players.map(p => ({
          ...p,
          courtNumber: p.courtNumber ?? 1,
          team: p.team ?? 'A',
        })),
      }));
    }
    return [];
  });

  const [activeTab, setActiveTab] = useState<TabId>('dashboard');

  // État du formulaire de match
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [matchNumber, setMatchNumber] = useState<number>(1);
  const [matchDate, setMatchDate] = useState<string>(new Date().toISOString().split('T')[0]);
  // Court slots: array of 8 slots (court 1: 0-3, court 6: 4-7)
  const [courtSlots, setCourtSlots] = useState<(string | null)[]>([null, null, null, null, null, null, null, null]);
  const [payments, setPayments] = useState<Record<string, PaymentInfo>>({});

  // Modale pour invité rapide
  const [newGuestName, setNewGuestName] = useState('');
  const [showGuestModal, setShowGuestModal] = useState(false);

  // Modale pour nouveau joueur
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerStatus, setNewPlayerStatus] = useState<PlayerStatus>('regular');
  const [newPlayerCreditorAmount, setNewPlayerCreditorAmount] = useState<number>(0);
  const [newPlayerStars, setNewPlayerStars] = useState<number>(0);
  const [newPlayerFederation, setNewPlayerFederation] = useState<Federation>('none');
  const [showNewPlayerModal, setShowNewPlayerModal] = useState(false);

  // Édition inline des fiches joueurs
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editPlayerName, setEditPlayerName] = useState('');
  const [editPlayerStatus, setEditPlayerStatus] = useState<PlayerStatus>('regular');
  const [editPlayerCredit, setEditPlayerCredit] = useState<number>(0);
  const [editPlayerStars, setEditPlayerStars] = useState<number>(0);
  const [editPlayerFederation, setEditPlayerFederation] = useState<Federation>('none');

  // Tri des fiches joueurs
  const [sortMode, setSortMode] = useState<'default' | 'alpha' | 'status' | 'stars'>('default');

  // Recherche / Filtres
  const [playerSearch, setPlayerSearch] = useState('');

  // --- SAUVEGARDE LOCALSTORAGE ---
  useEffect(() => {
    localStorage.setItem('padel_players', JSON.stringify(players));
  }, [players]);

  useEffect(() => {
    localStorage.setItem('padel_matches', JSON.stringify(matches));
  }, [matches]);

  // Prochain numéro de match suggéré
  useEffect(() => {
    if (!editingMatchId) {
      const maxNum = matches.reduce((max, m) => Math.max(max, m.number), 0);
      setMatchNumber(Math.min(maxNum + 1, TOTAL_SEASON_MATCHES));
    }
  }, [matches, editingMatchId]);

  // --- CALCULS COMPTABLES ---
  const creditorStats = useMemo(() => {
    const stats: Record<string, {
      id: string; name: string; initialCredit: number;
      recoveredSelf: number; recoveredCash: number;
      totalRecovered: number; remaining: number;
    }> = {};

    players.filter(p => p.isCreditor).forEach(c => {
      stats[c.id] = {
        id: c.id, name: c.name, initialCredit: c.initialCredit,
        recoveredSelf: 0, recoveredCash: 0,
        totalRecovered: 0, remaining: c.initialCredit,
      };
    });

    matches.forEach(m => {
      m.players.forEach(pRec => {
        const p = players.find(x => x.id === pRec.playerId);
        if (!p) return;

        if (p.isCreditor) {
          if (stats[p.id]) {
            stats[p.id].recoveredSelf += PRICE_PER_MATCH;
          }
        } else {
          if (pRec.paid && pRec.paidToCreditorId && stats[pRec.paidToCreditorId]) {
            stats[pRec.paidToCreditorId].recoveredCash += PRICE_PER_MATCH;
          }
        }
      });
    });

    Object.keys(stats).forEach(id => {
      stats[id].totalRecovered = stats[id].recoveredSelf + stats[id].recoveredCash;
      stats[id].remaining = stats[id].initialCredit - stats[id].totalRecovered;
    });

    return stats;
  }, [players, matches]);

  // Créancier prioritaire (celui qui a la plus grosse créance restante)
  const getHighestBalanceCreditorId = (): string => {
    const creditors = players.filter(p => p.isCreditor);
    if (!creditors.length) return '';
    let highestId = creditors[0].id;
    let maxRem = -Infinity;
    creditors.forEach(c => {
      const rem = creditorStats[c.id]?.remaining ?? c.initialCredit;
      if (rem > maxRem) {
        maxRem = rem;
        highestId = c.id;
      }
    });
    return highestId;
  };

  // Liste des impayés globaux
  const unpaidRecords = useMemo<UnpaidRecord[]>(() => {
    const list: UnpaidRecord[] = [];
    matches.forEach(m => {
      m.players.forEach(pRec => {
        const p = players.find(x => x.id === pRec.playerId);
        if (p && !p.isCreditor && !pRec.paid) {
          list.push({
            matchId: m.id,
            matchNumber: m.number,
            matchDate: m.date,
            playerId: p.id,
            playerName: p.name,
            amount: PRICE_PER_MATCH,
          });
        }
      });
    });
    return list.sort((a, b) => a.matchNumber - b.matchNumber);
  }, [players, matches]);

  // Statistiques Joueurs Individuelles
  const playerStats = useMemo(() => {
    const stats: Record<string, {
      matchesPlayed: number; totalDue: number;
      totalPaid: number; unpaidAmount: number;
    }> = {};

    players.forEach(p => {
      stats[p.id] = { matchesPlayed: 0, totalDue: 0, totalPaid: 0, unpaidAmount: 0 };
    });

    matches.forEach(m => {
      m.players.forEach(pRec => {
        if (!stats[pRec.playerId]) return;
        stats[pRec.playerId].matchesPlayed += 1;

        const p = players.find(x => x.id === pRec.playerId);
        if (p && !p.isCreditor) {
          stats[pRec.playerId].totalDue += PRICE_PER_MATCH;
          if (pRec.paid) {
            stats[pRec.playerId].totalPaid += PRICE_PER_MATCH;
          } else {
            stats[pRec.playerId].unpaidAmount += PRICE_PER_MATCH;
          }
        }
      });
    });

    return stats;
  }, [players, matches]);

  // --- STATISTIQUES PAIRES ---
  const pairStats = useMemo(() => {
    const result: Record<string, {
      partners: Record<string, number>;
      opponents: Record<string, number>;
      courts: Record<number, number>;
    }> = {};

    players.forEach(p => {
      result[p.id] = { partners: {}, opponents: {}, courts: {} };
    });

    matches.forEach(m => {
      // Group players by court and team
      const courts: Record<number, { teamA: PlayerRecord[]; teamB: PlayerRecord[] }> = {};
      m.players.forEach(pRec => {
        const cn = pRec.courtNumber || 1;
        const team = pRec.team || 'A';
        if (!courts[cn]) courts[cn] = { teamA: [], teamB: [] };
        if (team === 'A') courts[cn].teamA.push(pRec);
        else courts[cn].teamB.push(pRec);
      });

      Object.entries(courts).forEach(([cn, { teamA, teamB }]) => {
        const courtNum = parseInt(cn);

        // Partners: same team
        teamA.forEach(p1 => {
          if (!result[p1.playerId]) return;
          result[p1.playerId].courts[courtNum] = (result[p1.playerId].courts[courtNum] || 0) + 1;
          teamA.forEach(p2 => {
            if (p1.playerId !== p2.playerId) {
              result[p1.playerId].partners[p2.playerId] = (result[p1.playerId].partners[p2.playerId] || 0) + 1;
            }
          });
          // Opponents: other team
          teamB.forEach(p2 => {
            result[p1.playerId].opponents[p2.playerId] = (result[p1.playerId].opponents[p2.playerId] || 0) + 1;
          });
        });

        teamB.forEach(p1 => {
          if (!result[p1.playerId]) return;
          result[p1.playerId].courts[courtNum] = (result[p1.playerId].courts[courtNum] || 0) + 1;
          teamB.forEach(p2 => {
            if (p1.playerId !== p2.playerId) {
              result[p1.playerId].partners[p2.playerId] = (result[p1.playerId].partners[p2.playerId] || 0) + 1;
            }
          });
          teamA.forEach(p2 => {
            result[p1.playerId].opponents[p2.playerId] = (result[p1.playerId].opponents[p2.playerId] || 0) + 1;
          });
        });
      });
    });

    return result;
  }, [players, matches]);

  const getTopPartner = (playerId: string): { name: string; count: number } | null => {
    const partners = pairStats[playerId]?.partners;
    if (!partners) return null;
    const entries = Object.entries(partners).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) return null;
    const p = players.find(x => x.id === entries[0][0]);
    return p ? { name: p.name, count: entries[0][1] } : null;
  };

  const getTopOpponent = (playerId: string): { name: string; count: number } | null => {
    const opponents = pairStats[playerId]?.opponents;
    if (!opponents) return null;
    const entries = Object.entries(opponents).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) return null;
    const p = players.find(x => x.id === entries[0][0]);
    return p ? { name: p.name, count: entries[0][1] } : null;
  };

  const getFavoriteCourt = (playerId: string): { court: number; count: number } | null => {
    const courts = pairStats[playerId]?.courts;
    if (!courts) return null;
    const entries = Object.entries(courts).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) return null;
    return { court: parseInt(entries[0][0]), count: entries[0][1] };
  };

  const getFavoritePartners = (playerId: string, limit = 3): { name: string; count: number }[] => {
    const partners = pairStats[playerId]?.partners;
    if (!partners) return [];
    return Object.entries(partners)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id, count]) => ({ name: players.find(x => x.id === id)?.name || '?', count }));
  };

  // --- GESTION DES TERRAINS (SLOTS) ---
  const selectedPlayerIds = courtSlots.filter((id): id is string => id !== null);

  const handleAssignSlot = (slotIndex: number, playerId: string) => {
    setCourtSlots(prev => {
      const next = [...prev];
      // Remove player from any other slot
      for (let i = 0; i < next.length; i++) {
        if (next[i] === playerId) next[i] = null;
      }
      next[slotIndex] = playerId;
      return next;
    });
    // Set default payment
    const p = players.find(x => x.id === playerId);
    if (p && !p.isCreditor) {
      setPayments(prev => ({
        ...prev,
        [playerId]: {
          paid: true,
          paidToCreditorId: getHighestBalanceCreditorId(),
        },
      }));
    }
  };

  const handleClearSlot = (slotIndex: number) => {
    const playerId = courtSlots[slotIndex];
    setCourtSlots(prev => {
      const next = [...prev];
      next[slotIndex] = null;
      return next;
    });
    if (playerId) {
      setPayments(prev => {
        const next = { ...prev };
        delete next[playerId];
        return next;
      });
    }
  };

  const handlePaymentToggle = (playerId: string, paid: boolean) => {
    setPayments(prev => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        paid,
        paidToCreditorId: paid ? (prev[playerId]?.paidToCreditorId || getHighestBalanceCreditorId()) : null,
      },
    }));
  };

  const handleCreditorChange = (playerId: string, creditorId: string) => {
    setPayments(prev => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        paidToCreditorId: creditorId,
      },
    }));
  };

  const handleSaveMatch = (e: FormEvent) => {
    e.preventDefault();
    const filledSlots = courtSlots.filter((id): id is string => id !== null);
    if (filledSlots.length !== 8) {
      alert(`Veuillez placer exactement 8 joueurs sur les terrains (${filledSlots.length}/8 placés).`);
      return;
    }

    const matchPlayers: PlayerRecord[] = courtSlots.map((pId, slotIndex) => {
      if (!pId) return null;
      const p = players.find(x => x.id === pId)!;
      const courtNumber = slotIndex < 4 ? 1 : 6;
      const team: 'A' | 'B' = slotIndex % 4 < 2 ? 'A' : 'B';

      if (p.isCreditor) {
        return { playerId: pId, paid: true, paidToCreditorId: pId, courtNumber, team };
      }
      const payInfo = payments[pId] || { paid: false, paidToCreditorId: null };
      return {
        playerId: pId,
        paid: payInfo.paid,
        paidToCreditorId: payInfo.paid ? payInfo.paidToCreditorId : null,
        courtNumber,
        team,
      };
    }).filter((x): x is PlayerRecord => x !== null);

    const newMatch: Match = {
      id: editingMatchId || Date.now().toString(),
      number: parseInt(String(matchNumber)),
      date: matchDate,
      players: matchPlayers,
    };

    if (editingMatchId) {
      setMatches(matches.map(m => m.id === editingMatchId ? newMatch : m));
      setEditingMatchId(null);
    } else {
      setMatches([...matches, newMatch]);
    }

    setCourtSlots([null, null, null, null, null, null, null, null]);
    setPayments({});
    setActiveTab('matrix');
  };

  const handleEditMatch = (match: Match) => {
    setEditingMatchId(match.id);
    setMatchNumber(match.number);
    setMatchDate(match.date);

    // Rebuild court slots from match data
    const slots: (string | null)[] = [null, null, null, null, null, null, null, null];
    match.players.forEach(pRec => {
      const courtOffset = pRec.courtNumber === 6 ? 4 : 0;
      const teamOffset = pRec.team === 'B' ? 2 : 0;
      // Position within team: 0 or 1. We'll just use the order they appear.
      const sameTeamSlots = slots.map((s, i) => {
        const cn = i < 4 ? 1 : 6;
        const tm = i % 4 < 2 ? 'A' : 'B';
        return cn === pRec.courtNumber && tm === pRec.team && s === null;
      });
      const firstFree = sameTeamSlots.findIndex(Boolean);
      const slotIndex = courtOffset + teamOffset + (firstFree >= 0 ? Math.min(firstFree, 1) : 0);
      if (slotIndex >= 0 && slotIndex < 8) {
        slots[slotIndex] = pRec.playerId;
      }
    });

    setCourtSlots(slots);

    const payMap: Record<string, PaymentInfo> = {};
    match.players.forEach(p => {
      payMap[p.playerId] = {
        paid: p.paid,
        paidToCreditorId: p.paidToCreditorId,
      };
    });
    setPayments(payMap);
    setActiveTab('entry');
  };

  const handleDeleteMatch = (id: string) => {
    if (confirm('Voulez-vous vraiment supprimer ce match ?')) {
      setMatches(matches.filter(m => m.id !== id));
    }
  };

  // --- REGULARISATION RAPIDE DE DETTE ---
  const handleRegularizeDebt = (matchId: string, playerId: string, targetCreditorId: string) => {
    if (!targetCreditorId) return;
    setMatches(prevMatches => {
      return prevMatches.map(m => {
        if (m.id === matchId) {
          const updatedPlayers = m.players.map(p => {
            if (p.playerId === playerId) {
              return { ...p, paid: true, paidToCreditorId: targetCreditorId };
            }
            return p;
          });
          return { ...m, players: updatedPlayers };
        }
        return m;
      });
    });
  };

  // --- AJOUT D'UN INVITÉ ---
  const handleAddGuest = () => {
    if (!newGuestName.trim()) return;
    const guestId = 'guest_' + Date.now();
    const newPlayer: Player = {
      id: guestId,
      name: newGuestName.trim() + ' (Invité)',
      isCreditor: false,
      initialCredit: 0,
      isGuest: true,
      stars: 0,
      federation: 'none',
    };
    setPlayers([...players, newPlayer]);
    setNewGuestName('');
    setShowGuestModal(false);
  };

  // --- ÉDITION D'UN JOUEUR ---
  const handleStartEditPlayer = (p: Player) => {
    setEditingPlayerId(p.id);
    setEditPlayerName(p.name);
    setEditPlayerStatus(getStatusFromPlayer(p));
    setEditPlayerCredit(p.initialCredit);
    setEditPlayerStars(p.stars);
    setEditPlayerFederation(p.federation);
  };

  const handleCancelEditPlayer = () => {
    setEditingPlayerId(null);
    setEditPlayerName('');
    setEditPlayerStatus('regular');
    setEditPlayerCredit(0);
    setEditPlayerStars(0);
    setEditPlayerFederation('none');
  };

  const handleSaveEditPlayer = () => {
    if (!editPlayerName.trim() || !editingPlayerId) return;
    const isCreditor = editPlayerStatus === 'creditor-regular';
    const isGuest = editPlayerStatus === 'occasional';
    setPlayers(prev => prev.map(p =>
      p.id === editingPlayerId
        ? {
            ...p,
            name: editPlayerName.trim(),
            isCreditor,
            isGuest,
            initialCredit: isCreditor ? editPlayerCredit : 0,
            stars: editPlayerStars,
            federation: editPlayerFederation,
          }
        : p
    ));
    handleCancelEditPlayer();
  };

  // --- MISE À JOUR RAPIDE DES ÉTOILES ---
  const handleQuickUpdateStars = (playerId: string, stars: number) => {
    setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, stars } : p));
  };

  // --- MISE À JOUR RAPIDE DE LA FÉDÉRATION ---
  const handleQuickUpdateFederation = (playerId: string, federation: Federation) => {
    setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, federation } : p));
  };

  // --- AJOUT D'UN NOUVEAU JOUEUR ---
  const handleAddNewPlayer = () => {
    if (!newPlayerName.trim()) return;
    const newId = 'player_' + Date.now();
    const isCreditor = newPlayerStatus === 'creditor-regular';
    const newPlayer: Player = {
      id: newId,
      name: newPlayerName.trim(),
      isCreditor,
      initialCredit: isCreditor ? newPlayerCreditorAmount : 0,
      isGuest: newPlayerStatus === 'occasional',
      stars: newPlayerStars,
      federation: newPlayerFederation,
    };
    setPlayers([...players, newPlayer]);
    setNewPlayerName('');
    setNewPlayerStatus('regular');
    setNewPlayerCreditorAmount(0);
    setNewPlayerStars(0);
    setNewPlayerFederation('none');
    setShowNewPlayerModal(false);
  };

  // --- IMPORT / EXPORT JSON ---
  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify({ players, matches }, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `padel_compta_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileReader = new FileReader();
    fileReader.readAsText(file, 'UTF-8');
    fileReader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (parsed.players && parsed.matches) {
          const importedPlayers = (parsed.players as Player[]).map(p => ({
            ...p,
            stars: p.stars ?? 0,
            federation: p.federation ?? 'none',
          }));
          const importedMatches = (parsed.matches as Match[]).map(m => ({
            ...m,
            players: m.players.map((p: PlayerRecord) => ({
              ...p,
              courtNumber: p.courtNumber ?? 1,
              team: p.team ?? 'A',
            })),
          }));
          setPlayers(importedPlayers);
          setMatches(importedMatches);
          alert('Données importées avec succès !');
        } else {
          alert('Format JSON invalide.');
        }
      } catch {
        alert('Erreur lors de la lecture du fichier.');
      }
    };
  };

  // Totaux statistiques
  const totalUnpaid = unpaidRecords.length * PRICE_PER_MATCH;
  const totalCollected = matches.length * 8 * PRICE_PER_MATCH - totalUnpaid;
  const totalGuestParticipations = matches.reduce((acc, m) => {
    return acc + m.players.filter(p => {
      const pl = players.find(x => x.id === p.playerId);
      return pl && pl.isGuest;
    }).length;
  }, 0);

  const sortedMatches = [...matches].sort((a, b) => b.number - a.number);
  const filteredPlayers = useMemo(() => {
    let list = players.filter(p =>
      p.name.toLowerCase().includes(playerSearch.toLowerCase())
    );
    if (sortMode === 'alpha') {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    } else if (sortMode === 'status') {
      const order: Record<PlayerStatus, number> = { 'creditor-regular': 0, 'regular': 1, 'occasional': 2 };
      list = [...list].sort((a, b) => order[getStatusFromPlayer(a)] - order[getStatusFromPlayer(b)]);
    } else if (sortMode === 'stars') {
      list = [...list].sort((a, b) => b.stars - a.stars);
    }
    return list;
  }, [players, playerSearch, sortMode]);

  // Players not yet placed on any court
  const unplacedPlayers = players.filter(p => !courtSlots.includes(p.id));

  // Render a court slot dropdown
  const renderSlot = (slotIndex: number, label: string, courtLabel: string) => {
    const currentId = courtSlots[slotIndex];
    const currentP = currentId ? players.find(x => x.id === currentId) : null;
    return (
      <div className="flex flex-col items-center gap-1">
        <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">{label}</span>
        <select
          value={currentId || ''}
          onChange={(e) => e.target.value ? handleAssignSlot(slotIndex, e.target.value) : handleClearSlot(slotIndex)}
          className={`w-full bg-slate-900 border rounded-lg px-2 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 ${
            currentId ? 'border-emerald-500/50' : 'border-slate-700'
          }`}
        >
          <option value="">-- Libre --</option>
          {currentP && <option value={currentP.id}>{currentP.name}</option>}
          {unplacedPlayers.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        {currentP && (
          <span className="text-[10px] text-slate-400 truncate max-w-full">
            {currentP.isCreditor ? 'Créancier' : currentP.isGuest ? 'Invité' : 'Régulier'}
          </span>
        )}
      </div>
    );
  };

  // Render a padel court visual
  const renderPadelCourt = (courtNum: number, baseSlot: number) => {
    return (
      <div className="flex-1 min-w-[280px]">
        <h4 className="text-center text-sm font-bold text-emerald-400 mb-3">Terrain N°{courtNum}</h4>
        <div className="relative bg-emerald-900/20 border-2 border-emerald-600/40 rounded-xl p-4 overflow-hidden">
          {/* Court markings */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-full h-px bg-emerald-600/30" />
          </div>
          <div className="absolute inset-y-0 left-1/2 w-px bg-emerald-600/30 pointer-events-none" />
          {/* Net */}
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 flex items-center justify-center">
            <div className="w-full h-1 bg-slate-600/60 rounded-full" />
          </div>

          <div className="relative grid grid-rows-2 gap-6 min-h-[200px]">
            {/* Team A (top) */}
            <div className="flex justify-around items-start pt-2">
              {renderSlot(baseSlot, 'Équipe A - J1', courtNum.toString())}
              {renderSlot(baseSlot + 1, 'Équipe A - J2', courtNum.toString())}
            </div>
            {/* Team B (bottom) */}
            <div className="flex justify-around items-end pb-2">
              {renderSlot(baseSlot + 2, 'Équipe B - J1', courtNum.toString())}
              {renderSlot(baseSlot + 3, 'Équipe B - J2', courtNum.toString())}
            </div>
          </div>
        </div>
        <div className="text-center text-[10px] text-slate-500 mt-2">
          {courtSlots.slice(baseSlot, baseSlot + 4).filter((id): id is string => id !== null).length}/4 joueurs placés
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans pb-12">
      {/* --- EN-TÊTE ET NAVIGATION --- */}
      <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="bg-emerald-500 p-2.5 rounded-xl text-slate-900 shadow-lg shadow-emerald-500/20">
                <Grid className="w-6 h-6 font-bold" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                  PADEL <span className="text-emerald-400">MANAGER</span>
                </h1>
                <p className="text-xs text-slate-400">Saison Officielle • 44 Matchs • Suivi des Impayés</p>
              </div>
            </div>

            {/* Actions Sauvegarde */}
            <div className="flex items-center space-x-2">
              <button
                onClick={handleExportJSON}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-semibold text-slate-200 transition"
              >
                <Download className="w-4 h-4" />
                <span>Exporter</span>
              </button>
              <label className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-semibold text-slate-200 cursor-pointer transition">
                <Upload className="w-4 h-4" />
                <span>Importer</span>
                <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
              </label>
            </div>
          </div>

          {/* Onglets */}
          <nav className="flex space-x-2 mt-6 overflow-x-auto pb-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                activeTab === 'dashboard'
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                  : 'bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Tableau de Bord</span>
            </button>

            <button
              onClick={() => { setEditingMatchId(null); setCourtSlots([null, null, null, null, null, null, null, null]); setPayments({}); setActiveTab('entry'); }}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                activeTab === 'entry'
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                  : 'bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>Saisir un Match</span>
            </button>

            <button
              onClick={() => setActiveTab('matrix')}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                activeTab === 'matrix'
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                  : 'bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
              }`}
            >
              <Grid className="w-4 h-4" />
              <span>Matrice & Historique</span>
            </button>

            <button
              onClick={() => setActiveTab('players')}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                activeTab === 'players'
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                  : 'bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Fiches Joueurs</span>
              {unpaidRecords.length > 0 && (
                <span className="bg-rose-500 text-white text-xs px-2 py-0.5 rounded-full font-bold ml-1">
                  {unpaidRecords.length}
                </span>
              )}
            </button>
          </nav>
        </div>
      </header>

      {/* --- CONTENU PRINCIPAL --- */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ================= 1. TABLEAU DE BORD ================= */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            {/* Cartes Créanciers */}
            <div>
              <h2 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-400" />
                Avances de Frais (Créanciers Initiaux)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {players.filter(p => p.isCreditor).map(c => {
                  const stat = creditorStats[c.id] || { initialCredit: c.initialCredit, recoveredSelf: 0, recoveredCash: 0, remaining: c.initialCredit };
                  const percent = Math.min(100, Math.round(((c.initialCredit - stat.remaining) / c.initialCredit) * 100));

                  return (
                    <div key={c.id} className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-xl relative overflow-hidden">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <span className="text-xs uppercase font-semibold text-emerald-400 tracking-wider">Créancier</span>
                          <h3 className="text-xl font-bold text-white">{c.name}</h3>
                        </div>
                        <span className="text-2xl font-black text-slate-200">{c.initialCredit} €</span>
                      </div>

                      <div className="space-y-2 text-sm text-slate-300 mb-4">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Autoconsommé ({stat.recoveredSelf / PRICE_PER_MATCH} matchs) :</span>
                          <span className="font-medium text-emerald-300">{stat.recoveredSelf} €</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Remboursé en Cash :</span>
                          <span className="font-medium text-emerald-300">{stat.recoveredCash} €</span>
                        </div>
                        <div className="border-t border-slate-700 pt-2 flex justify-between font-bold">
                          <span>Reste à Récupérer :</span>
                          <span className={stat.remaining > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                            {stat.remaining} €
                          </span>
                        </div>
                      </div>

                      {/* Barre de Progression */}
                      <div className="w-full bg-slate-700 h-2.5 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        ></div>
                      </div>
                      <div className="text-right text-xs text-slate-400 mt-1">{percent}% récupéré</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Statistiques Globales */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4 flex items-center space-x-4">
                <div className="p-3 bg-blue-500/10 text-blue-400 rounded-lg">
                  <Calendar className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium">Progression Saison</p>
                  <p className="text-xl font-bold text-white">{matches.length} / {TOTAL_SEASON_MATCHES} matchs</p>
                </div>
              </div>

              <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4 flex items-center space-x-4">
                <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-lg">
                  <DollarSign className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium">Total Encaissé / Consommé</p>
                  <p className="text-xl font-bold text-emerald-400">{totalCollected} €</p>
                </div>
              </div>

              <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4 flex items-center space-x-4">
                <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-lg">
                  <UserPlus className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium">Participations Invités</p>
                  <p className="text-xl font-bold text-cyan-400">{totalGuestParticipations}</p>
                </div>
              </div>
            </div>

            {/* Encadré d'Alerte Impayés */}
            <div className="bg-slate-800 border border-rose-500/30 rounded-2xl p-6 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-rose-500/10 text-rose-400 rounded-xl">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Suivi des Impayés en Attente</h3>
                    <p className="text-xs text-slate-400">Paiements non réglés à régulariser auprès des créanciers</p>
                  </div>
                </div>
                <div className="bg-rose-500/10 border border-rose-500/20 px-4 py-2 rounded-xl text-right">
                  <span className="text-xs text-rose-300 uppercase font-semibold block">Total en Attente</span>
                  <span className="text-2xl font-black text-rose-400">{totalUnpaid} €</span>
                </div>
              </div>

              {unpaidRecords.length === 0 ? (
                <div className="bg-slate-900/50 rounded-xl p-6 text-center text-slate-400 flex items-center justify-center space-x-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span>Aucun impayé enregistré ! Tous les paiements sont à jour.</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-300">
                    <thead className="bg-slate-900/60 uppercase text-xs text-slate-400">
                      <tr>
                        <th className="px-4 py-3 rounded-l-lg">Match</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Joueur Débiteur</th>
                        <th className="px-4 py-3">Montant</th>
                        <th className="px-4 py-3 rounded-r-lg text-right">Action (Encaissement)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      {unpaidRecords.map((item, idx) => (
                        <tr key={`${item.matchId}_${item.playerId}_${idx}`} className="hover:bg-slate-700/30 transition">
                          <td className="px-4 py-3 font-bold text-emerald-400">Match #{item.matchNumber}</td>
                          <td className="px-4 py-3 text-slate-400">{item.matchDate}</td>
                          <td className="px-4 py-3 font-semibold text-white">{item.playerName}</td>
                          <td className="px-4 py-3 font-bold text-rose-400">{item.amount} €</td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-2">
                              <span className="text-xs text-slate-400">Payé à :</span>
                              {players.filter(p => p.isCreditor).map(creditor => (
                                <button
                                  key={creditor.id}
                                  onClick={() => handleRegularizeDebt(item.matchId, item.playerId, creditor.id)}
                                  className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/30 hover:border-emerald-500 text-emerald-300 hover:text-white rounded-md text-xs font-semibold transition"
                                >
                                  {creditor.name}
                                </button>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= 2. SAISIE / ÉDITION DE MATCH ================= */}
        {activeTab === 'entry' && (
          <div className="max-w-5xl mx-auto bg-slate-800 border border-slate-700 rounded-2xl p-6 sm:p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-700">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-emerald-400" />
                  {editingMatchId ? `Édition du Match #${matchNumber}` : 'Enregistrer un nouveau Match'}
                </h2>
                <p className="text-xs text-slate-400 mt-1">Placez les 8 joueurs sur les 2 terrains (4 par terrain, 2 par équipe)</p>
              </div>
              {editingMatchId && (
                <button
                  onClick={() => { setEditingMatchId(null); setCourtSlots([null, null, null, null, null, null, null, null]); setPayments({}); }}
                  className="text-xs text-slate-400 hover:text-white underline"
                >
                  Annuler l'édition
                </button>
              )}
            </div>

            <form onSubmit={handleSaveMatch} className="space-y-6">
              {/* Infos Match */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Numéro de Match (1 - 44)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="44"
                    value={matchNumber}
                    onChange={(e) => setMatchNumber(Number(e.target.value))}
                    required
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Date du Match
                  </label>
                  <input
                    type="date"
                    value={matchDate}
                    onChange={(e) => setMatchDate(e.target.value)}
                    required
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Disposition des terrains */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Disposition sur les Terrains ({selectedPlayerIds.length} / 8 joueurs placés)
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowGuestModal(true)}
                    className="flex items-center space-x-1 text-xs text-emerald-400 hover:text-emerald-300 font-semibold bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-lg"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>+ Ajouter un Invité</span>
                  </button>
                </div>

                <div className="flex flex-col lg:flex-row gap-6">
                  {renderPadelCourt(1, 0)}
                  {renderPadelCourt(6, 4)}
                </div>
              </div>

              {/* Statuts des Paiements pour les Joueurs sélectionnés non créanciers */}
              {selectedPlayerIds.length > 0 && (
                <div className="border-t border-slate-700 pt-6">
                  <h3 className="text-sm font-bold text-slate-200 mb-4 uppercase tracking-wider">
                    Statut des Paiements (13 € / joueur)
                  </h3>

                  <div className="space-y-3">
                    {selectedPlayerIds.map(pId => {
                      const p = players.find(x => x.id === pId);
                      if (!p) return null;

                      // Si créancier -> Autoconsommation automatique
                      if (p.isCreditor) {
                        return (
                          <div key={pId} className="flex items-center justify-between p-3 bg-slate-900/40 rounded-xl border border-slate-700/50">
                            <span className="text-sm font-semibold text-white">{p.name}</span>
                            <span className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3 py-1 rounded-lg font-medium">
                              Autoconsommation Créance (-13€)
                            </span>
                          </div>
                        );
                      }

                      // Pour les joueurs normaux / invités
                      const currentPay = payments[pId] || { paid: true, paidToCreditorId: getHighestBalanceCreditorId() };

                      return (
                        <div key={pId} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-slate-900/60 rounded-xl border border-slate-700/80 gap-3">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-semibold text-white">{p.name}</span>
                            {p.isGuest && <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">Invité</span>}
                          </div>

                          <div className="flex items-center gap-3">
                            {/* Toggle Payé / En Attente */}
                            <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
                              <button
                                type="button"
                                onClick={() => handlePaymentToggle(pId, true)}
                                className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                                  currentPay.paid ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
                                }`}
                              >
                                Payé sur place
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePaymentToggle(pId, false)}
                                className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                                  !currentPay.paid ? 'bg-rose-500 text-white' : 'text-slate-400 hover:text-white'
                                }`}
                              >
                                En attente
                              </button>
                            </div>

                            {/* Choix du créancier si Payé */}
                            {currentPay.paid && (
                              <select
                                value={currentPay.paidToCreditorId || ''}
                                onChange={(e) => handleCreditorChange(pId, e.target.value)}
                                className="bg-slate-800 border border-slate-700 text-xs text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500"
                              >
                                {players.filter(x => x.isCreditor).map(c => (
                                  <option key={c.id} value={c.id}>
                                    Donné à {c.name}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Bouton Sauvegarder */}
              <button
                type="submit"
                disabled={selectedPlayerIds.length !== 8}
                className={`w-full py-3.5 rounded-xl font-bold text-slate-950 transition flex items-center justify-center space-x-2 shadow-lg ${
                  selectedPlayerIds.length === 8
                    ? 'bg-emerald-400 hover:bg-emerald-300 shadow-emerald-500/20 cursor-pointer'
                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                }`}
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>{editingMatchId ? 'Mettre à jour le Match' : 'Valider et Enregistrer le Match'}</span>
              </button>
            </form>
          </div>
        )}

        {/* ================= 3. MATRICE & HISTORIQUE ================= */}
        {activeTab === 'matrix' && (
          <div className="space-y-8">
            {/* Matrice de Présence 1-44 */}
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
              <h2 className="text-lg font-bold text-white mb-2">Matrice Croisée des Présences</h2>
              <p className="text-xs text-slate-400 mb-6">Visualisation rapide des présences et règlements sur toute la saison (Matchs 1 à 44)</p>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-center border-collapse">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-2 px-3 text-slate-400 font-semibold min-w-[120px] sticky left-0 bg-slate-800 z-10">Joueur</th>
                      {Array.from({ length: TOTAL_SEASON_MATCHES }, (_, i) => i + 1).map(num => (
                        <th key={num} className="py-2 px-1 text-slate-400 min-w-[28px] font-mono">
                          {num}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {players.map(p => (
                      <tr key={p.id} className="hover:bg-slate-700/20">
                        <td className="text-left py-2 px-3 font-semibold text-slate-200 sticky left-0 bg-slate-800 z-10 truncate border-r border-slate-700/50">
                          {p.name}
                        </td>
                        {Array.from({ length: TOTAL_SEASON_MATCHES }, (_, i) => i + 1).map(num => {
                          const match = matches.find(m => m.number === num);
                          if (!match) {
                            return <td key={num} className="py-2 px-1 text-slate-700">•</td>;
                          }
                          const pRec = match.players.find(x => x.playerId === p.id);
                          if (!pRec) {
                            return <td key={num} className="py-2 px-1 text-slate-600/30">-</td>;
                          }

                          if (p.isCreditor) {
                            return (
                              <td key={num} className="py-2 px-1">
                                <span className="inline-block w-4 h-4 rounded-full bg-blue-500/20 border border-blue-400 text-blue-300 font-bold text-[9px] leading-4" title="Présent (Créancier)">C</span>
                              </td>
                            );
                          }

                          return (
                            <td key={num} className="py-2 px-1">
                              {pRec.paid ? (
                                <span className="inline-block w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-400 text-emerald-400 font-bold text-[9px] leading-4" title="Présent & Payé">✓</span>
                              ) : (
                                <span className="inline-block w-4 h-4 rounded-full bg-rose-500/20 border border-rose-400 text-rose-400 font-bold text-[9px] leading-4" title="Présent & Impayé">✕</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center flex-wrap gap-6 mt-4 pt-4 border-t border-slate-700 text-xs text-slate-400">
                <div className="flex items-center space-x-1.5">
                  <span className="w-3 h-3 rounded-full bg-blue-500/20 border border-blue-400"></span>
                  <span>Créancier (Autoconsommation)</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-400"></span>
                  <span>Présent & Payé</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="w-3 h-3 rounded-full bg-rose-500/20 border border-rose-400"></span>
                  <span>Présent & Impayé</span>
                </div>
              </div>
            </div>

            {/* Historique Détaillé */}
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
              <h2 className="text-lg font-bold text-white mb-4">Historique des Matchs Enregistrés</h2>
              {matches.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">Aucun match enregistré pour le moment.</p>
              ) : (
                <div className="space-y-4">
                  {sortedMatches.map(match => (
                    <div key={match.id} className="bg-slate-900/60 border border-slate-700/80 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center space-x-3 mb-2">
                          <span className="bg-emerald-500/10 text-emerald-400 font-bold px-2.5 py-1 rounded-lg text-xs border border-emerald-500/20">
                            Match #{match.number}
                          </span>
                          <span className="text-xs text-slate-400">{match.date}</span>
                        </div>
                        {/* Show court assignments */}
                        <div className="space-y-1.5">
                          {[1, 6].map(cn => {
                            const courtPlayers = match.players.filter(p => p.courtNumber === cn);
                            if (courtPlayers.length === 0) return null;
                            const teamA = courtPlayers.filter(p => p.team === 'A');
                            const teamB = courtPlayers.filter(p => p.team === 'B');
                            const getName = (pId: string) => players.find(x => x.id === pId)?.name || '?';
                            return (
                              <div key={cn} className="text-xs text-slate-300 flex items-center gap-2 flex-wrap">
                                <span className="text-emerald-400 font-bold">T{cn}:</span>
                                <span>{teamA.map(p => getName(p.playerId)).join(' & ')}</span>
                                <span className="text-slate-500">vs</span>
                                <span>{teamB.map(p => getName(p.playerId)).join(' & ')}</span>
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {match.players.map(pRec => {
                            const p = players.find(x => x.id === pRec.playerId);
                            if (!p) return null;
                            const isPaid = p.isCreditor || pRec.paid;

                            return (
                              <span
                                key={pRec.playerId}
                                className={`text-xs px-2.5 py-1 rounded-md font-medium border ${
                                  p.isCreditor
                                    ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                                    : isPaid
                                    ? 'bg-slate-800 border-slate-700 text-slate-200'
                                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                                }`}
                              >
                                {p.name} {!p.isCreditor && (!isPaid ? '(Impayé)' : '')}
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0 self-end md:self-center">
                        <button
                          onClick={() => handleEditMatch(match)}
                          className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
                          title="Éditer"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteMatch(match.id)}
                          className="p-2 bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg transition"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= 4. FICHES JOUEURS ================= */}
        {activeTab === 'players' && (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h2 className="text-lg font-bold text-white">Fiches Individuelles des Joueurs</h2>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                {/* Barre de recherche */}
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Rechercher un joueur..."
                    value={playerSearch}
                    onChange={(e) => setPlayerSearch(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                {/* Tri */}
                <select
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value as 'default' | 'alpha' | 'status' | 'stars')}
                  className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 shrink-0"
                >
                  <option value="default">Ordre par défaut</option>
                  <option value="alpha">Alphabétique (A-Z)</option>
                  <option value="status">Par statut</option>
                  <option value="stars">Par classement (étoiles)</option>
                </select>
                {/* Ajouter un joueur */}
                <button
                  onClick={() => setShowNewPlayerModal(true)}
                  className="flex items-center space-x-1.5 px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 hover:text-emerald-200 rounded-xl text-xs font-semibold transition shrink-0"
                >
                  <UserPlus className="w-4 h-4" />
                  <span className="hidden sm:inline">Nouveau Joueur</span>
                  <span className="sm:hidden">Joueur</span>
                </button>
              </div>
            </div>

            {/* Légende des étoiles */}
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-400">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 text-amber-400" fill="currentColor" />
                Légende des niveaux :
              </span>
              {STAR_LEVELS.map(s => (
                <span key={s.stars} className="flex items-center gap-1">
                  <StarRating value={s.stars} size="sm" />
                  <span className="text-slate-300 font-mono">{s.label}</span>
                </span>
              ))}
            </div>

            {/* Fiches joueurs existantes */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPlayers.map(p => {
                const stat = playerStats[p.id] || { matchesPlayed: 0, totalDue: 0, totalPaid: 0, unpaidAmount: 0 };
                const topPartner = getTopPartner(p.id);
                const topOpponent = getTopOpponent(p.id);
                const favCourt = getFavoriteCourt(p.id);
                const favPartners = getFavoritePartners(p.id);

                return (
                  <div key={p.id} className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        {editingPlayerId === p.id ? (
                          /* --- MODE ÉDITION --- */
                          <div className="flex-1 space-y-2 mr-2">
                            <div>
                              <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">Nom</label>
                              <input
                                type="text"
                                value={editPlayerName}
                                onChange={(e) => setEditPlayerName(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-emerald-500"
                                autoFocus
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">Statut</label>
                              <select
                                value={editPlayerStatus}
                                onChange={(e) => setEditPlayerStatus(e.target.value as PlayerStatus)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-emerald-500"
                              >
                                {(['creditor-regular', 'regular', 'occasional'] as PlayerStatus[]).map(s => (
                                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">Niveau (étoiles)</label>
                              <StarRating value={editPlayerStars} onChange={setEditPlayerStars} size="md" />
                              <span className="text-[10px] text-slate-500 mt-1 block">{getStarLabel(editPlayerStars)}</span>
                            </div>
                            <div>
                              <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">Fédération</label>
                              <select
                                value={editPlayerFederation}
                                onChange={(e) => setEditPlayerFederation(e.target.value as Federation)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-emerald-500"
                              >
                                {(['none', 'afp', 'aft', 'both'] as Federation[]).map(f => (
                                  <option key={f} value={f}>{FEDERATION_LABELS[f]}</option>
                                ))}
                              </select>
                            </div>
                            {editPlayerStatus === 'creditor-regular' && (
                              <div>
                                <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">Créance initiale (€)</label>
                                <input
                                  type="number"
                                  min="0"
                                  value={editPlayerCredit}
                                  onChange={(e) => setEditPlayerCredit(Number(e.target.value))}
                                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-emerald-500"
                                />
                              </div>
                            )}
                          </div>
                        ) : (
                          /* --- MODE AFFICHAGE --- */
                          <div>
                            <h3 className="font-bold text-lg text-white">{p.name}</h3>
                            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block mb-1">
                              {STATUS_LABELS[getStatusFromPlayer(p)]}
                            </span>
                            <StarRating value={p.stars} size="sm" />
                            <span className="text-[10px] text-amber-400/70 font-mono">{getStarLabel(p.stars)}</span>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="text-[10px] text-slate-400">Fédération :</span>
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                p.federation === 'none' ? 'text-slate-500 bg-slate-700/50' :
                                p.federation === 'both' ? 'text-purple-300 bg-purple-500/10 border border-purple-500/20' :
                                p.federation === 'afp' ? 'text-cyan-300 bg-cyan-500/10 border border-cyan-500/20' :
                                'text-orange-300 bg-orange-500/10 border border-orange-500/20'
                              }`}>
                                {FEDERATION_LABELS[p.federation]}
                              </span>
                            </div>
                          </div>
                        )}

                        {editingPlayerId === p.id ? (
                          /* Boutons Save / Cancel */
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={handleSaveEditPlayer}
                              className="p-2 bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 rounded-lg transition"
                              title="Enregistrer"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={handleCancelEditPlayer}
                              className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition"
                              title="Annuler"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          /* Badge + bouton Edit */
                          <div className="flex items-center gap-2 shrink-0">
                            {p.isCreditor ? (
                              <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs px-2.5 py-1 rounded-lg font-bold">
                                {creditorStats[p.id]?.remaining ?? p.initialCredit} € à recouvrer
                              </span>
                            ) : stat.unpaidAmount > 0 ? (
                              <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs px-2.5 py-1 rounded-lg font-bold">
                                Dette : {stat.unpaidAmount} €
                              </span>
                            ) : (
                              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs px-2.5 py-1 rounded-lg font-bold">
                                À jour
                              </span>
                            )}
                            <button
                              onClick={() => handleStartEditPlayer(p)}
                              className="p-2 bg-slate-700/80 hover:bg-slate-600 text-slate-300 hover:text-white rounded-lg transition"
                              title="Modifier"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2 text-xs text-slate-300 border-t border-slate-700/60 pt-3 mb-4">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Matchs Joués :</span>
                          <span className="font-bold text-white">{stat.matchesPlayed}</span>
                        </div>
                        {!p.isCreditor && (
                          <>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Total Dû (13€ x match) :</span>
                              <span className="font-medium text-slate-200">{stat.totalDue} €</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Total Réglé :</span>
                              <span className="font-medium text-emerald-400">{stat.totalPaid} €</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* --- GESTION DES PAIRES --- */}
                    {stat.matchesPlayed > 0 && (
                      <div className="bg-slate-900/40 rounded-xl p-3 border border-slate-700/50 text-xs space-y-2 mb-4">
                        <div className="flex items-center gap-1.5 font-semibold text-emerald-400 mb-1">
                          <Trophy className="w-3.5 h-3.5" />
                          <span>Statistiques Paires</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Partenaire le + fréquent :</span>
                          <span className="font-medium text-white">
                            {topPartner ? `${topPartner.name} (${topPartner.count}x)` : '-'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Adversaire le + fréquent :</span>
                          <span className="font-medium text-white">
                            {topOpponent ? `${topOpponent.name} (${topOpponent.count}x)` : '-'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Terrain préféré :</span>
                          <span className="font-medium text-white">
                            {favCourt ? `N°${favCourt.court} (${favCourt.count}x)` : '-'}
                          </span>
                        </div>
                        {favPartners.length > 0 && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Paires favorites :</span>
                            <span className="font-medium text-white text-right">
                              {favPartners.map(fp => `${fp.name} (${fp.count}x)`).join(', ')}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Liste des impayés spécifiques de ce joueur */}
                    {!p.isCreditor && stat.unpaidAmount > 0 && (
                      <div className="bg-slate-900/60 rounded-xl p-3 border border-rose-500/20 text-xs space-y-2">
                        <span className="font-semibold text-rose-300 block">Régularisation des impayés :</span>
                        {unpaidRecords
                          .filter(u => u.playerId === p.id)
                          .map(u => (
                            <div key={u.matchId} className="flex justify-between items-center bg-slate-800 p-2 rounded-lg">
                              <span>Match #{u.matchNumber}</span>
                              <div className="flex gap-1">
                                {players.filter(x => x.isCreditor).map(c => (
                                  <button
                                    key={c.id}
                                    onClick={() => handleRegularizeDebt(u.matchId, p.id, c.id)}
                                    className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500 hover:text-slate-950 font-bold rounded text-[10px] transition"
                                    title={`Payer à ${c.name}`}
                                  >
                                    Payé à {c.name}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* --- MODALE AJOUT JOUEUR --- */}
      {showNewPlayerModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white mb-2">Ajouter un Nouveau Joueur</h3>
            <p className="text-xs text-slate-400 mb-4">Renseignez le nom, le statut, le niveau et l'éventuelle créance.</p>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">Nom du joueur</label>
                <input
                  type="text"
                  placeholder="Ex : Philippe"
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">Statut</label>
                <select
                  value={newPlayerStatus}
                  onChange={(e) => setNewPlayerStatus(e.target.value as PlayerStatus)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500"
                >
                  {(['creditor-regular', 'regular', 'occasional'] as PlayerStatus[]).map(s => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">Niveau (étoiles)</label>
                <StarRating value={newPlayerStars} onChange={setNewPlayerStars} size="md" />
                <span className="text-[10px] text-slate-500 mt-1 block">{getStarLabel(newPlayerStars)}</span>
              </div>
              <div>
                <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">Fédération</label>
                <select
                  value={newPlayerFederation}
                  onChange={(e) => setNewPlayerFederation(e.target.value as Federation)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500"
                >
                  {(['none', 'afp', 'aft', 'both'] as Federation[]).map(f => (
                    <option key={f} value={f}>{FEDERATION_LABELS[f]}</option>
                  ))}
                </select>
              </div>
              {newPlayerStatus === 'creditor-regular' && (
                <div>
                  <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">Montant de l'avance (€)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Ex : 1500"
                    value={newPlayerCreditorAmount}
                    onChange={(e) => setNewPlayerCreditorAmount(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}
            </div>
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => setShowNewPlayerModal(false)}
                className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold rounded-xl transition"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleAddNewPlayer}
                className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl transition"
              >
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODALE AJOUT INVITÉ --- */}
      {showGuestModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">Ajouter un Joueur Invité</h3>
            <p className="text-xs text-slate-400 mb-4">L'invité sera disponible immédiatement dans la liste de sélection.</p>
            <input
              type="text"
              placeholder="Nom du joueur invité"
              value={newGuestName}
              onChange={(e) => setNewGuestName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500 mb-4"
              autoFocus
            />
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => setShowGuestModal(false)}
                className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold rounded-xl transition"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleAddGuest}
                className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl transition"
              >
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
