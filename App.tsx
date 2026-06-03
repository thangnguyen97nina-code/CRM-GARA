import React, { useState, useEffect } from 'react';
import { UserAccount, UserRole, IntakeForm, VehicleStatus } from './types';
import Dashboard from './components/Dashboard';
import IntakeFormView from './components/IntakeFormView';
import { garageDb, isSupabaseConfigured, SUPABASE_SQL_DDL } from './supabaseClient';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [forms, setForms] = useState<IntakeForm[]>([]);
  const [view, setView] = useState<'LOGIN' | 'DASHBOARD' | 'FORM' | 'USERS' | 'CRM' | 'SUPABASE_SETUP'>('LOGIN');
  const [editingForm, setEditingForm] = useState<IntakeForm | undefined>(undefined);
  const [isDbLoading, setIsDbLoading] = useState(false);

  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');

  // Search filter inside CRM view
  const [crmSearch, setCrmSearch] = useState('');
  const [selectedCrmPhone, setSelectedCrmPhone] = useState<string | null>(null);

  const LOGO_URL = "https://asiacar.vn/upload/filemanager/files/logo-qt.png";
  const APP_NAME = "BÊN TRONG GARA";
  const BRAND = "Phiên bản V3.0 PRO";

  // Initial accounts setup - preserved admin/admin and technician/advisor
  useEffect(() => {
    const fetchDB = async () => {
      setIsDbLoading(true);
      try {
        const loadedForms = await garageDb.getForms();
        setForms(loadedForms);
      } catch (err) {
        console.error("Failed to fetch initial garage forms: ", err);
      } finally {
        setIsDbLoading(false);
      }
    };
    fetchDB();

    const savedUsers = localStorage.getItem('garage_users');
    let userList: UserAccount[] = [];
    if (savedUsers) {
      try {
        userList = JSON.parse(savedUsers);
      } catch (e) {
        console.error(e);
      }
    }

    const hasAdmin = userList.find(u => u.username === 'admin');
    if (!hasAdmin) {
      const defaultAdmin: UserAccount = { 
        id: 'admin-id', 
        username: 'admin', 
        password: 'admin', 
        name: 'Chủ Garage', 
        role: UserRole.ADMIN,
        allowedStages: Object.values(VehicleStatus)
      };
      // Pre-add an Advisor and Technician to showcase RBAC flow
      const demoAdvisor: UserAccount = {
        id: 'advisor-id',
        username: 'advisor',
        password: '123',
        name: 'Nguyễn Văn Minh (Cố Vấn)',
        role: UserRole.ADVISOR,
        allowedStages: [VehicleStatus.INTAKE, VehicleStatus.HANDOVER, VehicleStatus.COMPLETED]
      };
      const demoTech: UserAccount = {
        id: 'tech-id',
        username: 'tech',
        password: '123',
        name: 'Trần Văn Kiên (Thợ Máy)',
        role: UserRole.TECHNICIAN,
        allowedStages: [VehicleStatus.EXECUTING, VehicleStatus.TECH_CHECK]
      };
      userList = [defaultAdmin, demoAdvisor, demoTech, ...userList];
    }
    setUsers(userList);
    localStorage.setItem('garage_users', JSON.stringify(userList));

    const savedSession = localStorage.getItem('garage_session');
    if (savedSession) {
      try {
        setCurrentUser(JSON.parse(savedSession));
        setView('DASHBOARD');
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const u = loginForm.username.trim();
    const p = loginForm.password.trim();
    
    const user = users.find(user => user.username === u && user.password === p);
    if (user) {
      setCurrentUser(user);
      localStorage.setItem('garage_session', JSON.stringify(user));
      setView('DASHBOARD');
      setError('');
    } else {
      setError('Tài khoản hoặc mật khẩu không chính xác. Hãy nhập admin/admin để tiếp tục!');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('garage_session');
    setView('LOGIN');
  };

  const handleSaveForm = async (form: IntakeForm) => {
    setIsDbLoading(true);
    try {
      const nextForms = await garageDb.saveForm(form);
      setForms(nextForms);
      setView('DASHBOARD');
      setEditingForm(undefined);
    } catch (err) {
      console.error(err);
      alert("Xảy ra lỗi khi đồng bộ thông tin.");
    } finally {
      setIsDbLoading(false);
    }
  };

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget as HTMLFormElement);
    const role = fd.get('role') as UserRole;
    
    let stages: VehicleStatus[] = [];
    if (role === UserRole.ADMIN) stages = Object.values(VehicleStatus);
    else if (role === UserRole.ADVISOR) stages = [VehicleStatus.INTAKE, VehicleStatus.TECH_CHECK, VehicleStatus.HANDOVER, VehicleStatus.COMPLETED];
    else if (role === UserRole.TECHNICIAN) stages = [VehicleStatus.EXECUTING, VehicleStatus.TECH_CHECK];

    const newUser: UserAccount = {
      id: Math.random().toString(36).substr(2, 9),
      name: fd.get('name') as string,
      username: (fd.get('username') as string).trim(),
      password: (fd.get('password') as string).trim(),
      role: role,
      allowedStages: stages
    };
    const nextUsers = [...users, newUser];
    setUsers(nextUsers);
    localStorage.setItem('garage_users', JSON.stringify(nextUsers));
    (e.target as HTMLFormElement).reset();
  };

  // Backups export / CSV compiler with BOM
  const handleCSVExport = () => {
    const headers = [
      "id", "orderCode", "plateNumber", "brand", "carName", "modelYear", "currentKm", 
      "customerName", "phone", "email", "address", "dateIn", "dateOut", "status", 
      "totalAmount", "detailedServices", "interiorSurvey", "condition", "vehicleImages", 
      "techNotes", "intakeSignature", "handoverSignature"
    ];

    const rows = forms.map(f => [
      f.id,
      f.orderCode,
      f.plateNumber,
      f.brand,
      f.carName,
      f.modelYear,
      f.odometer,
      f.customerName,
      f.phone,
      f.email,
      f.address,
      f.dateIn,
      f.dateOut,
      f.status,
      f.totalAmount,
      JSON.stringify(f.detailedServices || []),
      JSON.stringify(f.interiorSurvey || {}),
      JSON.stringify(f.condition || {}),
      JSON.stringify(f.vehicleImages || {}),
      f.techNotes || '',
      f.intakeSignature || '',
      f.handoverSignature || ''
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `BaoCao_Backup_Bentronggara_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split("\n");
        if (lines.length < 2) return;

        const headers = lines[0].split(",").map(h => h.replace(/^"|"$/g, '').trim());
        const parsedForms: IntakeForm[] = [];

        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          
          // Custom comma splitter ignoring quotes
          const matches = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || lines[i].split(",");
          const values = matches.map(v => v.replace(/^"|"$/g, '').replace(/""/g, '"').trim());

          if (values.length < 5) continue;

          const getVal = (headerName: string) => {
            const idx = headers.indexOf(headerName);
            return idx >= 0 ? values[idx] : '';
          };

          const parseJsonSafe = (str: string, fallback: any) => {
            try {
              return JSON.parse(str);
            } catch {
              return fallback;
            }
          };

          const detailedServices = parseJsonSafe(getVal("detailedServices"), []);
          const interiorSurvey = parseJsonSafe(getVal("interiorSurvey"), {});
          const condition = parseJsonSafe(getVal("condition"), {});
          const vehicleImages = parseJsonSafe(getVal("vehicleImages"), {});

          parsedForms.push({
            id: getVal("id") || Math.random().toString(36).substr(2, 9),
            orderCode: getVal("orderCode"),
            createdAt: new Date().toISOString(),
            advisorId: 'admin-id',
            plateNumber: getVal("plateNumber"),
            brand: getVal("brand"),
            carName: getVal("carName"),
            color: '',
            modelYear: getVal("modelYear"),
            vin: '',
            odometer: getVal("currentKm"),
            inspectionExpiry: '',
            customerName: getVal("customerName"),
            customerNamePrinted: getVal("customerName"),
            gender: '',
            company: '',
            phone: getVal("phone"),
            email: getVal("email"),
            address: getVal("address"),
            district: '',
            city: '',
            birthday: '',
            source: '',
            salesPerson: 'admin-id',
            dateIn: getVal("dateIn") || new Date().toISOString().split('T')[0],
            dateOut: getVal("dateOut"),
            status: getVal("status") as VehicleStatus,
            discount: 0,
            tax: 0,
            totalAmount: parseFloat(getVal("totalAmount")) || 0,
            detailedServices,
            services: [],
            otherRequests: '',
            interiorSurvey,
            condition,
            fuelLevel: 50,
            techNotes: getVal("techNotes"),
            vehicleImages,
            intakeSignature: getVal("intakeSignature") || null,
            handoverSignature: getVal("handoverSignature") || null,
            advisorName: 'Cố vấn'
          });
        }

        if (parsedForms.length > 0) {
          const next = await garageDb.bulkImport(parsedForms);
          setForms(next);
          alert(`Nhập thành công ${parsedForms.length} phiếu sửa chữa vào cơ sở dữ liệu!`);
        }
      } catch (err) {
        console.error(err);
        alert("Lỗi khi đọc file CSV. Hãy chắc chắn định dạng chuẩn UTF8.");
      }
    };
    reader.readAsText(file);
  };

  // CRM Aggregate customers from service forms list
  const aggregateCustomers = () => {
    const clients: Record<string, {
      customerName: string;
      phone: string;
      address: string;
      email: string;
      formsList: IntakeForm[];
      totalSpent: number;
    }> = {};

    forms.forEach(f => {
      const phoneClean = f.phone.trim();
      if (!phoneClean) return;
      if (!clients[phoneClean]) {
        clients[phoneClean] = {
          customerName: f.customerName,
          phone: f.phone,
          address: f.address,
          email: f.email,
          formsList: [],
          totalSpent: 0
        };
      }
      clients[phoneClean].formsList.push(f);
      if (f.status === VehicleStatus.COMPLETED) {
        clients[phoneClean].totalSpent += (f.totalAmount || 0);
      }
    });

    return Object.values(clients).sort((a, b) => b.totalSpent - a.totalSpent);
  };

  const allCustomers = aggregateCustomers();
  const filteredCustomers = allCustomers.filter(c => 
    c.customerName.toLowerCase().includes(crmSearch.toLowerCase()) || 
    c.phone.includes(crmSearch)
  );

  const selectedCrmClient = selectedCrmPhone 
    ? allCustomers.find(c => c.phone === selectedCrmPhone) 
    : allCustomers[0];

  // Calculated Operational Statistics
  const computeTotalStats = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    
    const todayReceipts = forms.filter(f => f.dateIn === todayStr).length;
    const executingCount = forms.filter(f => f.status === VehicleStatus.EXECUTING).length;
    const handoverCount = forms.filter(f => f.status === VehicleStatus.HANDOVER).length;

    // Daily completed order totals
    const dailyRevenue = forms
      .filter(f => f.status === VehicleStatus.COMPLETED && f.createdAt.startsWith(todayStr))
      .reduce((s, f) => s + (f.totalAmount || 0), 0);

    // Weekly completed order totals
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const weeklyRevenue = forms
      .filter(f => f.status === VehicleStatus.COMPLETED && new Date(f.createdAt) >= sevenDaysAgo)
      .reduce((s, f) => s + (f.totalAmount || 0), 0);

    // Monthly completed order totals
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const monthlyRevenue = forms
      .filter(f => f.status === VehicleStatus.COMPLETED && new Date(f.createdAt) >= thirtyDaysAgo)
      .reduce((s, f) => s + (f.totalAmount || 0), 0);

    return {
      todayReceipts,
      executingCount,
      handoverCount,
      dailyRevenue,
      weeklyRevenue,
      monthlyRevenue
    };
  };

  const totalStats = computeTotalStats();

  if (view === 'LOGIN') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white p-8 sm:p-12 rounded-[2.5rem] shadow-2xl max-w-sm w-full border-4 border-slate-100 relative overflow-hidden">
          <div className="text-center mb-10">
            <img src={LOGO_URL} alt="Logo" className="w-[70px] h-[70px] mx-auto object-contain mb-5 drop-shadow-md" />
            <h1 className="text-xl font-bold text-slate-900 uppercase tracking-tight leading-none text-blue-600">{APP_NAME}</h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mt-2.5">{BRAND}</p>
          </div>
          <form onSubmit={handleLoginSubmit} className="space-y-6">
            <div className="space-y-2">
               <label className="text-[10px] font-black text-slate-500 uppercase ml-1 block">Tài khoản truy cập</label>
               <input required placeholder="Nhập tên đăng nhập... (admin)" className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none font-semibold text-slate-900 focus:border-blue-600 focus:bg-white transition-all shadow-sm text-sm" value={loginForm.username} onChange={e => setLoginForm({...loginForm, username: e.target.value})} />
            </div>
            <div className="space-y-2">
               <label className="text-[10px] font-black text-slate-500 uppercase ml-1 block">Mật khẩu bảo mật</label>
               <input type="password" required placeholder="••••••••" className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none font-semibold text-slate-900 focus:border-blue-600 focus:bg-white transition-all shadow-sm text-sm" value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} />
            </div>
            {error && <p className="text-red-500 text-[10px] font-bold text-center italic leading-tight">{error}</p>}
            <button type="submit" className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-bold uppercase tracking-wider shadow-lg hover:bg-blue-600 transition-all text-xs cursor-pointer">Vào hệ thống</button>
          </form>
          
          <div className="mt-8 border-t border-slate-100 pt-4 text-center">
            <span className="text-[9px] text-slate-400 font-bold uppercase block">Phòng ban vận hành thử nghiệm:</span>
            <div className="flex justify-center gap-4 text-[9px] text-blue-600 font-black uppercase mt-2 tracking-wide">
              <span>A: admin / admin</span>
              <span>B: advisor / 123</span>
              <span>C: tech / 123</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      
      {/* Top sticky navigation bar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 px-4 sm:px-8 h-16 sm:h-20 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('DASHBOARD')}>
          <img src={LOGO_URL} alt="Logo" className="w-8 h-8 sm:w-10 sm:h-10 object-contain" />
          <div>
            <h2 className="text-sm sm:text-base font-black text-slate-950 tracking-tight leading-none text-blue-600">{APP_NAME}</h2>
            <p className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{BRAND}</p>
          </div>
        </div>
        
        {/* Navigation Action Buttons (RBAC + CRM) */}
        <div className="flex items-center gap-2 sm:gap-4">
          <button onClick={() => setView('DASHBOARD')} className={`px-3 py-2 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all ${view === 'DASHBOARD' ? 'bg-slate-900 text-white shadow' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Bảng điều khiển</button>
          
          <button onClick={() => { setSelectedCrmPhone(null); setView('CRM'); }} className={`px-3 py-2 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all ${view === 'CRM' ? 'bg-slate-900 text-white shadow' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            CRM Khách hàng & Xe
          </button>

          {currentUser?.role === UserRole.ADMIN && (
            <>
              <button onClick={() => setView('USERS')} className={`px-3 py-2 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all ${view === 'USERS' ? 'bg-slate-900 text-white shadow' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Nhân sự</button>
              <button onClick={() => setView('SUPABASE_SETUP')} className={`px-3 py-2 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all ${view === 'SUPABASE_SETUP' ? 'bg-slate-900 text-white shadow' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Kết nối Supabase</button>
            </>
          )}

          {/* User Session card */}
          <div className="hidden md:flex flex-col items-end border-l border-slate-200 pl-4">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-tight">{currentUser?.name}</span>
            <span className="text-[8px] font-black text-blue-600 uppercase tracking-widest">{currentUser?.role}</span>
          </div>

          <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-600 transition-colors cursor-pointer" title="Đăng xuất">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          </button>
        </div>
      </nav>

      {/* Main Workspace Frame */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        
        {/* Loading Spinner Overlays */}
        {isDbLoading && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex flex-col items-center justify-center text-white">
            <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 font-bold text-xs uppercase tracking-widest text-white">Đang xử lý đồng bộ dữ liệu...</p>
          </div>
        )}

        {/* 1. DASHBOARD VIEW */}
        {view === 'DASHBOARD' && currentUser && (
          <Dashboard 
            forms={forms} 
            currentUser={currentUser} 
            onNewForm={() => { setEditingForm(undefined); setView('FORM'); }} 
            onViewForm={(f) => { setEditingForm(f); setView('FORM'); }} 
            onDeleteForm={async id => {
              if (confirm('Bạn chắc chắn muốn xoá phiếu sửa chữa này chứ?')) {
                setIsDbLoading(true);
                const next = forms.filter(f => f.id !== id);
                setForms(next);
                localStorage.setItem('garage_forms', JSON.stringify(next));
                setIsDbLoading(false);
              }
            }} 
            totalStats={totalStats}
          />
        )}

        {/* 2. INTAKE STEPPER FORM VIEW */}
        {view === 'FORM' && currentUser && (
          <IntakeFormView 
            onSave={handleSaveForm} 
            onCancel={() => setView('DASHBOARD')} 
            currentUser={currentUser} 
            initialData={editingForm} 
            existingForms={forms} 
          />
        )}

        {/* 3. ROSTER TEAM MEMBERS WORKLIST (ADMIN ONLY) */}
        {view === 'USERS' && currentUser?.role === UserRole.ADMIN && (
          <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div className="bg-white p-6 sm:p-10 rounded-3xl shadow-sm border border-slate-200">
              <h2 className="text-xl font-bold text-slate-900 uppercase tracking-tight mb-8 flex items-center gap-2">
                <span className="w-1.5 h-4 bg-blue-600 rounded-full"></span>
                Quản lý Đội ngũ Kỹ sư & Cố vấn
              </h2>
              <form onSubmit={handleAddUser} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Tên nhân viên</label>
                  <input required name="name" className="w-full p-3 bg-white border border-slate-200 rounded-xl font-semibold text-slate-900 outline-none focus:border-blue-500 shadow-sm text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Username Đăng nhập</label>
                  <input required name="username" className="w-full p-3 bg-white border border-slate-200 rounded-xl font-semibold text-slate-900 outline-none focus:border-blue-500 shadow-sm text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Mật khẩu</label>
                  <input required name="password" type="text" className="w-full p-3 bg-white border border-slate-200 rounded-xl font-semibold text-slate-900 outline-none focus:border-blue-500 shadow-sm text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Bộ phận tác vụ (Phân quyền)</label>
                  <select name="role" className="w-full p-3 bg-white border border-slate-200 rounded-xl font-semibold text-slate-900 outline-none focus:border-blue-500 shadow-sm text-sm">
                    <option value={UserRole.ADVISOR}>SERVICE ADVISOR (Tiếp nhận, báo giá, giao bốc)</option>
                    <option value={UserRole.TECHNICIAN}>TECHNICIAN (Sửa máy, cập nhật check-list)</option>
                    <option value={UserRole.ADMIN}>ADMIN (Toàn quyền hệ quản trị)</option>
                  </select>
                </div>
                <button type="submit" className="sm:col-span-2 lg:col-span-4 bg-slate-950 text-white py-4 rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-blue-600 transition-all mt-2 shadow-md cursor-pointer">Thêm nhân sự mới</button>
              </form>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {users.map(u => (
                  <div key={u.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-500 transition-all group">
                    <div className="flex justify-between items-start mb-4">
                       <div className="text-base font-bold text-slate-900 uppercase tracking-tight leading-tight">{u.name}</div>
                       <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-md text-[8px] font-bold uppercase">{u.role}</span>
                    </div>
                    <div className="space-y-2 pt-4 border-t border-slate-50">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 font-bold uppercase text-[9px]">Tài khoản:</span>
                        <span className="font-bold text-slate-900">{u.username}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 font-bold uppercase text-[9px]">Mật khẩu đăng nhập:</span>
                        <span className="font-bold text-blue-600">{u.password}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 4. CRM & REPAIR VEHICLE TIMELINE HISTORY */}
        {view === 'CRM' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="bg-white p-6 sm:p-10 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 uppercase tracking-tight flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-blue-600 rounded-full"></span>
                    CRM Hệ thống Khách hàng & Lịch sử sửa chữa Xe
                  </h2>
                  <p className="text-slate-400 text-xs font-semibold mt-1">Quản lý tổng số lượt sửa và chi tiêu tích lũy qua timeline đại diện điện tử</p>
                </div>

                {/* Import / Export action triggers */}
                <div className="flex gap-2 w-full md:w-auto">
                  <button onClick={handleCSVExport} className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm cursor-pointer">
                    📥 Xuất sao lưu (CSV)
                  </button>
                  <label className="px-4 py-2.5 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm cursor-pointer">
                    📤 Nhập từ Excel/CSV
                    <input type="file" accept=".csv" onChange={handleCSVImport} className="hidden" />
                  </label>
                </div>
              </div>

              {/* Large customer list lookup filtering */}
              <div className="grid grid-cols-12 gap-8">
                
                {/* Left column: Customers directory list */}
                <div className="col-span-12 md:col-span-4 space-y-4">
                  <input 
                    type="text" 
                    placeholder="Tìm tên khách hàng hoặc SĐT..." 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 focus:bg-white outline-none font-semibold text-xs"
                    value={crmSearch}
                    onChange={(e) => setCrmSearch(e.target.value)}
                  />

                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                    {filteredCustomers.length > 0 ? filteredCustomers.map(client => {
                      const isSelected = selectedCrmClient?.phone === client.phone;
                      return (
                        <div 
                          key={client.phone}
                          onClick={() => setSelectedCrmPhone(client.phone)}
                          className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                            isSelected ? 'bg-blue-600 border-blue-600 text-white shadow shadow-blue-200' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <div>
                            <span className="text-xs font-bold uppercase flex justify-between">
                              {client.customerName || 'N/A'}
                            </span>
                            <span className={`text-[10px] font-mono mt-0.5 block ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>{client.phone}</span>
                          </div>
                          <div className="flex justify-between items-center mt-3 border-t pt-2 border-white/10 text-[10px]">
                            <span className={isSelected ? 'text-blue-100' : 'text-slate-500'}>Lượt ghé: <strong>{client.formsList.length} lần</strong></span>
                            <span className={`font-mono font-bold ${isSelected ? 'text-white' : 'text-emerald-600'}`}>{client.totalSpent.toLocaleString()}đ</span>
                          </div>
                        </div>
                      );
                    }) : (
                      <p className="text-center text-slate-300 font-bold uppercase text-[9px] py-10">Chưa có khách hàng</p>
                    )}
                  </div>
                </div>

                {/* Right col: Timeline of selected Customer visits */}
                <div className="col-span-12 md:col-span-8 bg-slate-50/50 p-6 rounded-2xl border border-slate-100 shadow-inner">
                  {selectedCrmClient ? (
                    <div className="space-y-6">
                      
                      {/* Customer Summary header card */}
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                          <h4 className="text-xl font-bold uppercase text-slate-900 tracking-tight">{selectedCrmClient.customerName}</h4>
                          <span className="text-xs font-mono font-bold text-slate-400 block mt-1">SĐT: {selectedCrmClient.phone} • {selectedCrmClient.email}</span>
                          <span className="text-xs font-medium text-slate-500 mt-2 block">{selectedCrmClient.address}</span>
                        </div>
                        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-right">
                          <span className="text-[8px] font-black text-emerald-600 uppercase block tracking-wider">Tổng tích lũy bảo hiểm & dịch vụ:</span>
                          <span className="text-2xl font-black text-emerald-800 font-mono inline-block mt-1">{selectedCrmClient.totalSpent.toLocaleString()}đ</span>
                        </div>
                      </div>

                      {/* Timeline entries list */}
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Dòng sự kiện dịch vụ (Timeline Lịch sử Xe)</h4>
                      <div className="relative border-l-2 border-slate-200 pl-6 ml-3 space-y-8 max-h-[500px] overflow-y-auto pr-2 no-scrollbar">
                        {selectedCrmClient.formsList.map(item => (
                          <div key={item.id} className="relative bg-white p-5 rounded-2xl border border-slate-200 shadow-sm group">
                            
                            {/* timeline node icon */}
                            <div className="absolute -left-[35px] top-6 w-4 h-4 rounded-full bg-blue-600 border-4 border-white shadow shadow-blue-500"></div>

                            <div className="flex justify-between items-start flex-wrap gap-2 mb-3">
                              <div>
                                <span className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-[10px] font-extrabold uppercase font-mono">{item.plateNumber}</span>
                                <span className="text-[10px] font-black text-slate-400 font-mono uppercase ml-2 select-all">{item.orderCode}</span>
                              </div>
                              <span className="text-[10px] text-slate-400 font-bold font-mono">Hoàn thành: {new Date(item.createdAt).toLocaleDateString('vi-VN')}</span>
                            </div>

                            <div className="mb-4">
                              <h5 className="text-sm font-bold text-slate-900 uppercase">{item.brand} {item.carName || 'N/A'}</h5>
                              <p className="text-[10px] text-slate-500 font-medium">Số odo lúc vào: <strong className="font-mono">{Number(item.odometer).toLocaleString()} KM</strong></p>
                            </div>

                            <table className="w-full text-left text-[9px] border-t border-slate-100 pt-3">
                              <thead>
                                <tr className="text-slate-400 uppercase font-black">
                                  <th className="py-1">Hạng mục phụ tùng</th>
                                  <th className="py-1 text-center">SL</th>
                                  <th className="py-1 text-right">Chi phí</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                {item.detailedServices.map(srv => (
                                  <tr key={srv.id}>
                                    <td className="py-1 font-bold text-slate-800 uppercase leading-none">{srv.name}</td>
                                    <td className="py-1 text-center font-bold text-slate-400 font-mono">{srv.quantity}</td>
                                    <td className="py-1 text-right font-black text-slate-900 font-mono">{(srv.price * srv.quantity).toLocaleString()}đ</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>

                            {/* View form modal selection button */}
                            <div className="mt-4 border-t border-slate-100 pt-3 flex justify-between items-center flex-wrap gap-2">
                              <span className="text-xs font-black text-slate-900 font-mono">Thanh toán: <span className="text-emerald-600">{(item.totalAmount || 0).toLocaleString()}đ</span></span>
                              <button 
                                onClick={() => { setEditingForm(item); setView('FORM'); }}
                                className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                              >
                                Xem lại hồ sơ & In lại hoá đơn A4 →
                              </button>
                            </div>

                          </div>
                        ))}
                      </div>

                    </div>
                  ) : (
                    <div className="text-center py-24 text-slate-300 font-bold uppercase tracking-widest text-xs">Hãy chọn một khách hàng kiểm tra lịch trình sửa xe</div>
                  )}
                </div>

              </div>
            </div>
          </div>
        )}

        {/* 5. CONNECTION GUIDE & DIAGNOSTIC CARD (SUPABASE SCHEMAS) */}
        {view === 'SUPABASE_SETUP' && currentUser?.role === UserRole.ADMIN && (
          <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div className="bg-slate-900 text-white p-6 sm:p-12 rounded-[2.5rem] shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
              
              <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight italic mb-2 relative z-10 text-blue-400">
                KẾT NỐI DATABASE RELATIONAL SUPABASE
              </h2>
              <p className="text-slate-400 text-xs font-semibold leading-relaxed mb-8 relative z-10 max-w-2xl">
                Cấu hình các trường biến khoá môi trường trong tệp tin <code className="text-white font-mono bg-white/10 px-1.5 py-0.5 rounded">.env.example</code> thành <code className="text-white font-mono bg-white/10 px-1.5 py-0.5 rounded">.env.local</code> của website. Dữ liệu sẽ tự động chuyển đổi từ LocalStorage sang Supabase.
              </p>

              <div className="space-y-6 relative z-10">
                <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700 font-mono text-xs text-blue-200">
                  <p className="font-bold text-white uppercase text-[10px] tracking-wider mb-2 text-blue-400">Trạng thái kết nối hiện tại:</p>
                  <p>✓ Trình gán: <span className={isSupabaseConfigured ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>{isSupabaseConfigured ? 'BẢN SUPABASE TRỰC TIẾP' : 'GIẢ LẬP SQL LOCALSTORAGE'}</span></p>
                  <p className="mt-1">✓ VITE_SUPABASE_URL: <span className="text-white font-mono">{isSupabaseConfigured ? (import.meta as any).env?.VITE_SUPABASE_URL : 'Chưa định thông'}</span></p>
                </div>

                <div className="space-y-3">
                  <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest block font-mono">Tập lệnh SQL tạo 8 bảng liên kết (SQL DDL):</span>
                  <div className="relative">
                    <pre className="p-4 bg-slate-950 rounded-xl font-mono text-[9px] text-slate-300 overflow-x-auto select-all max-h-80" style={{ whiteSpace: 'pre-wrap' }}>
                      {SUPABASE_SQL_DDL}
                    </pre>
                    <div className="absolute top-3 right-3 bg-slate-800 px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase text-white/80 cursor-pointer select-none hover:bg-slate-700 transition" onClick={() => {
                        navigator.clipboard.writeText(SUPABASE_SQL_DDL);
                        alert("Đã sao chép kịch bản SQL vào khay nhớ tạm!");
                    }}>Copy Script</div>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-normal italic font-semibold">Copy trọn vẹn đoạn mã lệnh tạo bảng trên và chạy chúng trong mục SQL Editor trong giao diện bảng điều khiển Supabase của bạn.</p>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

      <footer className="p-4 sm:p-8 text-center text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest bg-white border-t border-slate-200">
        &copy; 2026 QUẢN LÝ GARAGE THÔNG MINH - {LOGO_URL && 'BÊN TRONG GARA'} - THIẾT KẾ ĐO LƯỜNG SỐ HOÁ
      </footer>
    </div>
  );
};

export default App;
