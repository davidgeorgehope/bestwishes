'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Zap, Users, BarChart3, ArrowLeft, RefreshCw, ChevronLeft, ChevronRight, Heart } from 'lucide-react';

interface Stats {
  total_users: number;
  total_cards: number;
  cards_today: number;
  total_examples: number;
}

interface User {
  id: number;
  email: string;
  created_at: number;
  is_active: number;
  is_admin: number;
}

interface Card {
  id: number;
  user_id: number;
  prompt: string;
  occasion: string | null;
  style: string | null;
  status: string;
  created_at: number;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

interface PaginationState {
  page: number;
  pages: number;
  total: number;
}

type Tab = 'stats' | 'users' | 'cards';

export default function AdminPage() {
  const { token, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('stats');
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usersPagination, setUsersPagination] = useState<PaginationState>({ page: 1, pages: 1, total: 0 });
  const [cardsPagination, setCardsPagination] = useState<PaginationState>({ page: 1, pages: 1, total: 0 });

  const fetchUsers = useCallback(async (page: number = 1) => {
    if (!token) return;
    const headers = { 'Authorization': `Bearer ${token}` };
    const res = await fetch(`/api/admin/users?page=${page}`, { headers });
    if (res.ok) {
      const data: PaginatedResponse<User> = await res.json();
      setUsers(data.items);
      setUsersPagination({ page: data.page, pages: data.pages, total: data.total });
    }
  }, [token]);

  const fetchCards = useCallback(async (page: number = 1) => {
    if (!token) return;
    const headers = { 'Authorization': `Bearer ${token}` };
    const res = await fetch(`/api/admin/cards?page=${page}`, { headers });
    if (res.ok) {
      const data: PaginatedResponse<Card> = await res.json();
      setCards(data.items);
      setCardsPagination({ page: data.page, pages: data.pages, total: data.total });
    }
  }, [token]);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    try {
      const headers = { 'Authorization': `Bearer ${token}` };

      // Fetch stats first to check admin access
      const statsRes = await fetch('/api/admin/stats', { headers });
      if (statsRes.status === 403) {
        setError('You do not have admin access');
        setLoading(false);
        return;
      }
      if (!statsRes.ok) {
        throw new Error('Failed to fetch admin data');
      }
      const statsData = await statsRes.json();
      setStats(statsData);

      // Fetch paginated data in parallel
      await Promise.all([
        fetchUsers(1),
        fetchCards(1)
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [token, fetchUsers, fetchCards]);

  useEffect(() => {
    if (!authLoading && !token) {
      router.push('/login');
    }
  }, [authLoading, token, router]);

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token, fetchData]);

  const formatDate = (timestamp: number) => {
    if (!timestamp) return 'Never';
    return new Date(timestamp * 1000).toLocaleString();
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <Zap className="w-12 h-12 text-purple-500 animate-pulse mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!token) return null;

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
            <h2 className="text-xl font-semibold text-red-600 mb-2">Access Denied</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
            >
              Go Back Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50">
      {/* Header */}
      <header className="border-b border-gray-200 backdrop-blur-sm bg-white/80">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/')}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <Zap className="w-6 h-6 text-purple-500" />
                <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
              </div>
            </div>
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="container mx-auto px-6">
          <div className="flex gap-1">
            {[
              { id: 'stats', label: 'Overview', icon: BarChart3 },
              { id: 'users', label: 'Users', icon: Users },
              { id: 'cards', label: 'Cards', icon: Heart }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? 'text-purple-600 border-purple-500'
                    : 'text-gray-500 border-transparent hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="container mx-auto px-6 py-8">
        {loading && !stats ? (
          <div className="text-center py-12">
            <Zap className="w-8 h-8 text-purple-500 animate-pulse mx-auto mb-4" />
            <p className="text-gray-600">Loading data...</p>
          </div>
        ) : (
          <>
            {/* Stats Tab */}
            {activeTab === 'stats' && stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Total Users" value={stats.total_users} />
                <StatCard label="Total Cards" value={stats.total_cards} />
                <StatCard label="Cards Today" value={stats.cards_today} />
                <StatCard label="Example Cards" value={stats.total_examples} />
              </div>
            )}

            {/* Users Tab */}
            {activeTab === 'users' && (
              <div className="space-y-4">
                <div className="bg-white/80 border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="text-left px-4 py-3 text-gray-600 font-medium">ID</th>
                        <th className="text-left px-4 py-3 text-gray-600 font-medium">Email</th>
                        <th className="text-left px-4 py-3 text-gray-600 font-medium">Signed Up</th>
                        <th className="text-left px-4 py-3 text-gray-600 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(user => (
                        <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-700">{user.id}</td>
                          <td className="px-4 py-3">
                            <span className="text-gray-900">{user.email}</span>
                            {user.is_admin ? (
                              <span className="ml-2 px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">Admin</span>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-gray-600">{formatDate(user.created_at)}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 text-xs rounded ${
                              user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {user.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {users.length === 0 && (
                    <div className="text-center py-8 text-gray-500">No users found</div>
                  )}
                </div>
                <Pagination
                  pagination={usersPagination}
                  onPageChange={fetchUsers}
                />
              </div>
            )}

            {/* Cards Tab */}
            {activeTab === 'cards' && (
              <div className="space-y-4">
                <div className="bg-white/80 border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="text-left px-4 py-3 text-gray-600 font-medium">ID</th>
                        <th className="text-left px-4 py-3 text-gray-600 font-medium">User ID</th>
                        <th className="text-left px-4 py-3 text-gray-600 font-medium">Prompt</th>
                        <th className="text-left px-4 py-3 text-gray-600 font-medium">Occasion</th>
                        <th className="text-left px-4 py-3 text-gray-600 font-medium">Status</th>
                        <th className="text-left px-4 py-3 text-gray-600 font-medium">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cards.map(card => (
                        <tr key={card.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-700">{card.id}</td>
                          <td className="px-4 py-3 text-gray-700">{card.user_id}</td>
                          <td className="px-4 py-3 text-gray-900 max-w-xs truncate">{card.prompt}</td>
                          <td className="px-4 py-3 text-gray-600">{card.occasion || '-'}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 text-xs rounded ${
                              card.status === 'completed' ? 'bg-green-100 text-green-700' :
                              card.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {card.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600">{formatDate(card.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {cards.length === 0 && (
                    <div className="text-center py-8 text-gray-500">No cards found</div>
                  )}
                </div>
                <Pagination
                  pagination={cardsPagination}
                  onPageChange={fetchCards}
                />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white/80 border border-gray-200 rounded-lg p-4 shadow-sm">
      <div className="text-gray-600 text-sm mb-1">
        {label}
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
    </div>
  );
}

function Pagination({ pagination, onPageChange }: { pagination: PaginationState; onPageChange: (page: number) => void }) {
  if (pagination.pages <= 1) return null;

  return (
    <div className="flex items-center justify-between">
      <div className="text-sm text-gray-600">
        {pagination.total} total
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(pagination.page - 1)}
          disabled={pagination.page <= 1}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-gray-700 text-sm">
          Page {pagination.page} of {pagination.pages}
        </span>
        <button
          onClick={() => onPageChange(pagination.page + 1)}
          disabled={pagination.page >= pagination.pages}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
