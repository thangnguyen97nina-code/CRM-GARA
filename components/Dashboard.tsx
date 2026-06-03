import React, { useState } from 'react';
import { IntakeForm, UserRole, UserAccount, VehicleStatus } from '../types';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';

interface DashboardProps {
  forms: IntakeForm[];
  currentUser: UserAccount;
  onNewForm: () => void;
  onViewForm: (form: IntakeForm) => void;
  onDeleteForm: (id: string) => void;
  totalStats: {
    todayReceipts: number;
    executingCount: number;
    handoverCount: number;
    dailyRevenue: number;
    weeklyRevenue: number;
    monthlyRevenue: number;
  };
}

const Dashboard: React.FC<DashboardProps> = ({ 
  forms, 
  currentUser, 
  onNewForm, 
  onViewForm, 
  onDeleteForm,
  totalStats
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const accessibleForms = currentUser.role === UserRole.ADMIN 
    ? forms 
    : forms.filter(f => currentUser.allowedStages.includes(f.status));

  const filteredForms = accessibleForms.filter(form => 
    form.plateNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    form.phone.includes(searchTerm) ||
    form.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (form.orderCode && form.orderCode.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Group Completed stats by Date to supply Recharts dataset
  const buildRevenueData = () => {
    const dailyMap: Record<string, number> = {};
    // Populate last 7 days with 0 initial to guarantee nice curves
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
      dailyMap[ds] = 0;
    }

    const completed = forms.filter(f => f.status === VehicleStatus.COMPLETED);
    completed.forEach(f => {
      const fd = new Date(f.createdAt);
      if (!isNaN(fd.getTime())) {
        const ds = fd.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
        dailyMap[ds] = (dailyMap[ds] || 0) + (f.totalAmount || 0);
      }
    });

    return Object.entries(dailyMap).map(([date, revenue]) => ({
      name: date,
      'Doanh thu': revenue
    }));
  };

  const buildStatusDistribution = () => {
    const stages = Object.values(VehicleStatus);
    return stages.map(s => {
      const count = forms.filter(f => f.status === s).length;
      return {
        name: s.split(' ')[0], // short label
        fullName: s,
        'Số xe': count,
      };
    });
  };

  const revenueSeries = buildRevenueData();
  const statusSeries = buildStatusDistribution();

  const STATUS_COLORS = ['#3b82f6', '#f59e0b', '#6366f1', '#10b981', '#059669'];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom duration-700">
      
      {/* 1. OPERATIONS METRICS BOARD */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow shadow-md relative overflow-hidden flex flex-col justify-between h-32">
          <div className="absolute right-4 top-4 bg-white/10 rounded-xl p-2.5">
            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Doanh thu Hôm nay</span>
            <div className="text-2xl font-black text-emerald-400 font-mono mt-1">{totalStats.dailyRevenue.toLocaleString()}đ</div>
          </div>
          <span className="text-[9px] text-slate-500 font-bold uppercase">Nguồn: Quyết toán hoá đơn hoàn thành</span>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between h-32">
          <div className="absolute right-4 top-4 bg-blue-50 text-blue-600 rounded-xl p-2.5">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Doanh thu Tuần này</span>
            <div className="text-2xl font-black text-blue-600 font-mono mt-1">{totalStats.weeklyRevenue.toLocaleString()}đ</div>
          </div>
          <span className="text-[9px] text-slate-400 font-bold uppercase">Tổng thu lỹ kế 7 ngày qua</span>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between h-32">
          <div className="absolute right-4 top-4 bg-teal-50 text-teal-600 rounded-xl p-2.5">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Doanh thu Tháng 06</span>
            <div className="text-2xl font-black text-teal-600 font-mono mt-1">{totalStats.monthlyRevenue.toLocaleString()}đ</div>
          </div>
          <span className="text-[9px] text-slate-400 font-bold uppercase">Tổng thu lũy kế 30 ngày qua</span>
        </div>
      </div>

      {/* OPERATING COUNTER PILLS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex items-center justify-between shadow-inner">
          <div>
            <span className="text-[9px] font-bold text-blue-500 uppercase block tracking-wider">Chốt xe Hôm nay</span>
            <span className="text-xl font-extrabold text-blue-900 font-mono mt-0.5 block">{totalStats.todayReceipts} xe</span>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md">Vào xưởng</span>
        </div>
        <div className="bg-amber-50/80 p-4 rounded-xl border border-amber-200 flex items-center justify-between">
          <div>
            <span className="text-[9px] font-bold text-amber-600 uppercase block tracking-wider">Đang cơ khí gầm</span>
            <span className="text-xl font-extrabold text-amber-950 font-mono mt-0.5 block">{totalStats.executingCount} xe</span>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 bg-amber-100 text-amber-700 rounded-md animate-pulse">Thi công</span>
        </div>
        <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 flex items-center justify-between">
          <div>
            <span className="text-[9px] font-bold text-indigo-500 uppercase block tracking-wider">Chờ bàn giao xe</span>
            <span className="text-xl font-extrabold text-indigo-900 font-mono mt-0.5 block">{totalStats.handoverCount} xe</span>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-md">Quyết toán</span>
        </div>
        <div className="bg-emerald-50/80 p-4 rounded-xl border border-emerald-200 flex items-center justify-between">
          <div>
            <span className="text-[9px] font-bold text-emerald-600 uppercase block tracking-wider">Tổng sản lượng</span>
            <span className="text-xl font-extrabold text-emerald-950 font-mono mt-0.5 block">{forms.length} xe</span>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-md">Lịch sử</span>
        </div>
      </div>

      {/* 2. DYNAMIC GRAPHS AND CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Revenue Chronology Graph */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-900 mb-6 flex items-center gap-2">
            <span className="w-1 h-4 bg-blue-600 rounded-full"></span>
            Biểu đồ Doanh thu (Tuần gần nhất)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} fontWeight="bold" />
                <YAxis stroke="#94a3b8" fontSize={9} fontWeight="bold" tickFormatter={v => `${v/1000}k`} />
                <Tooltip 
                  formatter={(value: any) => [`${value.toLocaleString()} đ`, 'Doanh thu']}
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="Doanh thu" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRevs)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Vehicle distribution across checklist states */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-900 mb-6 flex items-center gap-2">
            <span className="w-1 h-4 bg-indigo-600 rounded-full"></span>
            Biểu đồ Phân bổ trạng thái Xe
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusSeries}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} fontWeight="bold" />
                <YAxis stroke="#94a3b8" fontSize={9} fontWeight="bold" allowDecimals={false} />
                <Tooltip 
                  formatter={(value: any) => [`${value} xe`, 'Số lượng']}
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', color: '#fff', fontSize: '11px', fontWeight: 'bold' }}
                />
                <Bar dataKey="Số xe" radius={[6, 6, 0, 0]}>
                  {statusSeries.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 3. LIST OF CARS OPERATING SECTION */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-lg font-bold text-slate-900 uppercase tracking-tight flex items-center gap-2">
          <span className="w-1 h-4 bg-blue-600 rounded-full"></span>
          Danh sách xe hiện có trong xưởng
        </h1>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button onClick={onNewForm} className="w-full sm:w-auto px-5 py-3 bg-blue-600 text-white rounded-xl font-bold uppercase text-[10px] tracking-widest shadow-md hover:bg-blue-700 transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer">
            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
            Tiếp nhận xe mới
          </button>
        </div>
      </div>

      {/* Large modern search bar */}
      <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </span>
          <input 
            type="text" 
            placeholder="Tìm biển số, khách hàng, số điện thoại, mã phiếu bảo dưỡng..." 
            className="block w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-transparent rounded-xl focus:bg-white focus:border-blue-500 outline-none text-slate-900 font-semibold transition-all placeholder:text-slate-400 text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Grid of Vehicles */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredForms.length > 0 ? filteredForms.map((form) => (
          <div 
            key={form.id} 
            onClick={() => onViewForm(form)}
            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-500 hover:shadow transition-all cursor-pointer group relative overflow-hidden flex flex-col justify-between"
          >
            <div>
              <div className="flex justify-between items-start mb-4">
                <span className="px-3 py-1.5 bg-slate-900 text-white rounded-lg font-bold text-xs tracking-wide font-mono group-hover:bg-blue-600 transition-all uppercase">{form.plateNumber}</span>
                <span className={`px-2.5 py-1 rounded-lg font-bold text-[9px] uppercase border shadow-inner ${
                  form.status === VehicleStatus.COMPLETED ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                  form.status === VehicleStatus.EXECUTING ? 'bg-amber-50 text-amber-700 border-amber-200' :
                  form.status === VehicleStatus.TECH_CHECK ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                  'bg-blue-50 text-blue-700 border-blue-200'
                }`}>
                  {form.status.split(' ')[0]}
                </span>
              </div>
              
              <div className="mb-4">
                <div className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1 font-mono">{form.orderCode || 'CHƯA MÃ'}</div>
                <h3 className="text-lg font-bold text-slate-900 uppercase truncate group-hover:text-blue-600 transition-colors">{form.customerName || 'Vô danh'}</h3>
                <p className="text-xs font-medium text-slate-400 mt-1">{form.brand} {form.carName || 'Chưa nhận dạng model'}</p>
              </div>
            </div>

            <div className="flex justify-between items-end border-t border-slate-100 pt-4 mt-6">
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Hóa đơn</span>
                <span className="text-base font-black text-slate-900 font-mono">{(form.totalAmount || 0).toLocaleString()}đ</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] font-bold text-blue-600 uppercase tracking-wider group-hover:translate-x-1 transition-transform">
                Chi tiết
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              </div>
            </div>
          </div>
        )) : (
          <div className="col-span-full py-24 text-center text-slate-300 font-bold uppercase tracking-[0.3em] border-2 border-dashed border-slate-200 rounded-3xl text-xs bg-slate-50/50">
            Không tìm thấy xe nào khớp với từ khoá
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
