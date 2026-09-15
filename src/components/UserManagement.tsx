import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { sendPasswordResetEmail, getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { initializeApp, deleteApp } from 'firebase/app';
import { db, auth } from '../lib/firebase';
import { useAppStore } from '../store';
import { translations } from '../lib/translations';
import { UserProfile } from '../types';
import { UserPlus, Edit2, Trash2, Key, CheckCircle, XCircle, X, Search, Shield, MapPin, Phone, Mail } from 'lucide-react';

export default function UserManagement() {
  const { user, language } = useAppStore();
  const t = translations[language];
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  
  // Forms & State
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserProfile | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [submitting, setSubmitting] = useState(false);

  const initialForm = {
    name: '',
    email: '',
    phone: '',
    address: '',
    role: 'WORKER' as UserProfile['role'],
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
    password: '',
    confirmPassword: ''
  };
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    if (user?.farmId) {
      fetchUsers();
    }
  }, [user?.farmId]);

  const fetchUsers = async () => {
    try {
      const q = query(collection(db, 'users'), where('farmId', '==', user!.farmId));
      const snap = await getDocs(q);
      const fetchedUsers = snap.docs.map(doc => doc.data() as UserProfile);
      setUsers(fetchedUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const createAuthUser = async (email: string, pass: string) => {
    const config = auth.app.options;
    const tempApp = initializeApp(config, 'TempApp-' + Date.now());
    const tempAuth = getAuth(tempApp);
    try {
      const cred = await createUserWithEmailAndPassword(tempAuth, email, pass);
      const uid = cred.user.uid;
      await deleteApp(tempApp);
      return uid;
    } catch (error) {
      await deleteApp(tempApp);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingUser) {
        // Update user
        const userRef = doc(db, 'users', editingUser.uid);
        await updateDoc(userRef, {
          name: form.name,
          phone: form.phone,
          address: form.address,
          role: form.role,
          status: form.status,
        });
        alert(t.userUpdated || 'User updated successfully.');
      } else {
        // Create new user
        if (form.password !== form.confirmPassword) {
          alert(t.passwordMismatch || 'Passwords do not match.');
          setSubmitting(false);
          return;
        }
        if (!form.password || form.password.length < 6) {
          alert('Password must be at least 6 characters.');
          setSubmitting(false);
          return;
        }
        
        // 1. Create auth user securely
        const newUid = await createAuthUser(form.email, form.password);
        
        // 2. Add to Firestore users collection
        const newUserRef = doc(db, 'users', newUid);
        await setDoc(newUserRef, {
          uid: newUid,
          name: form.name,
          email: form.email,
          phone: form.phone,
          address: form.address,
          role: form.role,
          status: form.status,
          farmId: user!.farmId,
          languagePref: 'en',
          createdAt: Date.now(),
          createdBy: user!.uid
        });
        alert(t.userCreated || 'User created successfully.');
      }
      setIsModalOpen(false);
      fetchUsers();
    } catch (error: any) {
      console.error(error);
      alert(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingUser) return;
    try {
      await deleteDoc(doc(db, 'users', deletingUser.uid));
      alert(t.userDeleted || 'User deleted successfully.');
      setIsDeleteModalOpen(false);
      fetchUsers();
    } catch (error: any) {
      console.error(error);
      alert(error.message);
    }
  };

  const handleResetPassword = async (email: string) => {
    if (confirm(t.resetPasswordConfirm || 'Send a password reset link?')) {
      try {
        await sendPasswordResetEmail(auth, email);
        alert('Password reset link sent to ' + email);
      } catch (error: any) {
        console.error(error);
        alert(error.message);
      }
    }
  };

  const handleEdit = (u: UserProfile) => {
    setEditingUser(u);
    setForm({
      name: u.name,
      email: u.email,
      phone: u.phone || '',
      address: u.address || '',
      role: u.role,
      status: u.status || 'ACTIVE',
      password: '',
      confirmPassword: ''
    });
    setIsModalOpen(true);
  };

  const openAddModal = () => {
    setEditingUser(null);
    setForm(initialForm);
    setIsModalOpen(true);
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'ALL' || u.role === filterRole;
    const matchesStatus = filterStatus === 'ALL' || (u.status || 'ACTIVE') === filterStatus;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const getRoleBadgeColor = (role: string) => {
    switch(role) {
      case 'ADMIN': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'MANAGER': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'ACCOUNTANT': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default: return 'bg-stone-100 text-stone-700 border-stone-200';
    }
  };

  const getRoleLabel = (role: string) => {
    switch(role) {
      case 'ADMIN': return t.adminRole || 'Admin';
      case 'MANAGER': return t.managerRole || 'Manager';
      case 'ACCOUNTANT': return t.accountantRole || 'Accountant';
      case 'STAFF':
      case 'WORKER': return t.workerRole || 'Worker';
      default: return role;
    }
  };

  if (loading) return <div>Loading users...</div>;

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-stone-100 pb-4">
        <h2 className="text-xl font-bold text-stone-800">{t.userManagement || 'User Management'}</h2>
        <button
          onClick={openAddModal}
          className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors"
        >
          <UserPlus size={18} />
          <span>{t.addUser || 'Add User'}</span>
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
          <input
            type="text"
            placeholder={t.searchUsers || 'Search users...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
          />
        </div>
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
        >
          <option value="ALL">{t.allRoles || 'All Roles'}</option>
          <option value="ADMIN">{t.adminRole || 'Admin'}</option>
          <option value="MANAGER">{t.managerRole || 'Manager'}</option>
          <option value="ACCOUNTANT">{t.accountantRole || 'Accountant'}</option>
          <option value="WORKER">{t.workerRole || 'Worker'}</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
        >
          <option value="ALL">{t.allStatuses || 'All Statuses'}</option>
          <option value="ACTIVE">{t.activeUser || 'Active'}</option>
          <option value="INACTIVE">{t.inactiveUser || 'Inactive'}</option>
        </select>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-50 text-stone-500 text-sm border-b border-stone-200">
                <th className="p-4 font-medium">{t.fullName || 'Name'}</th>
                <th className="p-4 font-medium">{t.roleLabel || 'Role'}</th>
                <th className="p-4 font-medium">Contact</th>
                <th className="p-4 font-medium">{t.status || 'Status'}</th>
                <th className="p-4 font-medium text-right">{t.actions || 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredUsers.length > 0 ? filteredUsers.map((u) => (
                <tr key={u.uid} className="hover:bg-stone-50/50 transition-colors">
                  <td className="p-4">
                    <div className="font-medium text-stone-800">{u.name}</div>
                    <div className="text-sm text-stone-500 flex items-center space-x-1 mt-0.5">
                      <Mail size={12} />
                      <span>{u.email}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border ${getRoleBadgeColor(u.role)}`}>
                      <Shield size={12} className="mr-1" />
                      {getRoleLabel(u.role)}
                    </span>
                  </td>
                  <td className="p-4">
                    {u.phone && (
                      <div className="text-sm text-stone-600 flex items-center space-x-1">
                        <Phone size={12} />
                        <span>{u.phone}</span>
                      </div>
                    )}
                    {u.address && (
                      <div className="text-sm text-stone-500 flex items-center space-x-1 mt-0.5">
                        <MapPin size={12} />
                        <span>{u.address}</span>
                      </div>
                    )}
                  </td>
                  <td className="p-4">
                    {(u.status || 'ACTIVE') === 'ACTIVE' ? (
                      <span className="inline-flex items-center text-green-600 text-sm font-medium">
                        <CheckCircle size={14} className="mr-1" />
                        {t.activeUser || 'Active'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-red-600 text-sm font-medium">
                        <XCircle size={14} className="mr-1" />
                        {t.inactiveUser || 'Inactive'}
                      </span>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="flex justify-end space-x-2">
                      <button onClick={() => handleResetPassword(u.email)} title={t.resetPassword || 'Reset Password'} className="p-2 text-stone-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors">
                        <Key size={16} />
                      </button>
                      <button onClick={() => handleEdit(u)} title={t.editUser || 'Edit'} className="p-2 text-stone-400 hover:text-green-600 hover:bg-green-50 rounded-xl transition-colors">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => { setDeletingUser(u); setIsDeleteModalOpen(true); }} title={t.deleteUser || 'Delete'} className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-stone-500">
                    {t.noUsers || 'No users found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-stone-100">
              <h3 className="text-xl font-bold text-stone-800">
                {editingUser ? (t.editUser || 'Edit User') : (t.addUser || 'Add User')}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-stone-400 hover:text-stone-600">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">{t.fullName || 'Full Name'} *</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={e => setForm({...form, name: e.target.value})}
                    className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">{t.emailAddress || 'Email Address'} *</label>
                  <input
                    type="email"
                    required
                    disabled={!!editingUser}
                    value={form.email}
                    onChange={e => setForm({...form, email: e.target.value})}
                    className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">{t.mobileNumber || 'Mobile Number'}</label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={e => setForm({...form, phone: e.target.value})}
                    className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">{t.address || 'Address'}</label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={e => setForm({...form, address: e.target.value})}
                    className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
                  />
                </div>
                
                {!editingUser && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1">{t.password || 'Password'} *</label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={form.password}
                        onChange={e => setForm({...form, password: e.target.value})}
                        className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1">{t.confirmPassword || 'Confirm Password'} *</label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={form.confirmPassword}
                        onChange={e => setForm({...form, confirmPassword: e.target.value})}
                        className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
                      />
                    </div>
                  </>
                )}
                
                <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">{t.roleLabel || 'Assigned Role'}</label>
                    <select
                      value={form.role}
                      onChange={e => setForm({...form, role: e.target.value as any})}
                      className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
                    >
                      <option value="ADMIN">{t.admin || 'Admin (Full Access)'}</option>
                      <option value="MANAGER">{t.manager || 'Manager (Operations)'}</option>
                      <option value="ACCOUNTANT">{t.accountant || 'Accountant (Finance)'}</option>
                      <option value="WORKER">{t.worker || 'Worker (Tasks)'}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">{t.accountStatus || 'Account Status'}</label>
                    <select
                      value={form.status}
                      onChange={e => setForm({...form, status: e.target.value as any})}
                      className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
                    >
                      <option value="ACTIVE">{t.activeUser || 'Active'}</option>
                      <option value="INACTIVE">{t.inactiveUser || 'Inactive'}</option>
                    </select>
                  </div>
                </div>
              </div>
              
              <div className="pt-6 border-t border-stone-100 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2.5 text-stone-600 font-medium hover:bg-stone-100 rounded-xl transition-colors"
                >
                  {t.cancel || 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 bg-green-600 text-white font-medium hover:bg-green-700 rounded-xl transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : (t.saveChanges || 'Save Changes')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold text-stone-800 mb-2">{t.deleteUser || 'Delete User'}</h3>
              <p className="text-stone-500 mb-6">{t.deleteUserConfirm || 'Are you sure you want to delete this user?'}</p>
              
              <div className="flex justify-center space-x-3">
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="px-6 py-2.5 text-stone-600 font-medium hover:bg-stone-100 rounded-xl transition-colors"
                >
                  {t.cancel || 'Cancel'}
                </button>
                <button
                  onClick={handleDelete}
                  className="px-6 py-2.5 bg-red-600 text-white font-medium hover:bg-red-700 rounded-xl transition-colors"
                >
                  {t.deleteUser || 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
