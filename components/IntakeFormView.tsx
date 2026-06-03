import React, { useState, useEffect, useRef } from 'react';
import { IntakeForm, UserAccount, VehicleStatus, ServiceItem, UserRole, VehicleImages } from '../types';
import { INTERIOR_SURVEY_ITEMS, CONDITION_ITEMS, SERVICE_CHECKLIST } from '../constants';
import SignaturePad from './SignaturePad';
import PrintTemplate from './PrintTemplate';

interface IntakeFormViewProps {
  onSave: (form: IntakeForm) => void;
  onCancel: () => void;
  currentUser: UserAccount;
  initialData?: Partial<IntakeForm>;
  existingForms?: IntakeForm[];
}

const IntakeFormView: React.FC<IntakeFormViewProps> = ({ onSave, onCancel, currentUser, initialData, existingForms = [] }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [activePrint, setActivePrint] = useState<'INTAKE' | 'HANDOVER' | null>(null);

  // Fallback initial structures
  const defaultImages: VehicleImages = {
    front: '',
    rear: '',
    left: '',
    right: '',
    interior: '',
    engine: ''
  };

  const [formData, setFormData] = useState<IntakeForm>({
    id: initialData?.id || Math.random().toString(36).substr(2, 9),
    orderCode: initialData?.orderCode || '',
    createdAt: initialData?.createdAt || new Date().toISOString(),
    advisorId: initialData?.advisorId || currentUser.id,
    status: initialData?.status || VehicleStatus.INTAKE,
    plateNumber: initialData?.plateNumber || '',
    brand: initialData?.brand || '',
    color: initialData?.color || '',
    modelYear: initialData?.modelYear || '',
    carName: initialData?.carName || '',
    vin: initialData?.vin || '',
    odometer: initialData?.odometer || '',
    inspectionExpiry: initialData?.inspectionExpiry || '',
    dateIn: initialData?.dateIn || new Date().toISOString().split('T')[0],
    dateOut: initialData?.dateOut || '',
    customerName: initialData?.customerName || '',
    customerNamePrinted: initialData?.customerNamePrinted || '',
    gender: initialData?.gender || '',
    company: initialData?.company || '',
    phone: initialData?.phone || '',
    email: initialData?.email || '',
    address: initialData?.address || '',
    district: initialData?.district || '',
    city: initialData?.city || '',
    birthday: initialData?.birthday || '',
    source: initialData?.source || '',
    salesPerson: initialData?.salesPerson || '',
    services: initialData?.services || [],
    detailedServices: (initialData?.detailedServices || []).map(item => ({
      ...item,
      status: item.status || (item.isDone ? 'DONE' : 'PENDING'),
      timestamp: item.timestamp || ''
    })),
    discount: initialData?.discount || 0,
    tax: initialData?.tax || 0,
    totalAmount: initialData?.totalAmount || 0,
    otherRequests: initialData?.otherRequests || '',
    interiorSurvey: initialData?.interiorSurvey || {},
    condition: initialData?.condition || {},
    fuelLevel: initialData?.fuelLevel || 50,
    techNotes: initialData?.techNotes || '',
    vehicleImages: initialData?.vehicleImages || defaultImages,
    intakeSignature: initialData?.intakeSignature || null,
    handoverSignature: initialData?.handoverSignature || null,
    advisorSignature: initialData?.advisorSignature || null,
    advisorName: initialData?.advisorName || currentUser.name,
  });

  const topRef = useRef<HTMLDivElement>(null);

  // Role-based Access Control Policies
  const canEdit = currentUser.role === UserRole.ADMIN || 
                 (formData.status === VehicleStatus.INTAKE && currentUser.role === UserRole.ADVISOR) ||
                 (formData.status === VehicleStatus.EXECUTING && currentUser.role === UserRole.TECHNICIAN) ||
                 (formData.status === VehicleStatus.TECH_CHECK && currentUser.role === UserRole.TECHNICIAN) ||
                 (formData.status === VehicleStatus.HANDOVER && currentUser.role === UserRole.ADVISOR);

  useEffect(() => {
    const subtotal = formData.detailedServices.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const total = (subtotal - formData.discount) * (1 + formData.tax / 100);
    setFormData(prev => ({ ...prev, totalAmount: total }));
  }, [formData.detailedServices, formData.discount, formData.tax]);

  // Rule Engine: Smart suggested services helper (Non-AI, 100% conditional logic)
  const getOdometerSuggestions = (): { name: string; price: number }[] => {
    const km = parseInt(formData.odometer) || 0;
    const suggestions: { name: string; price: number }[] = [];

    if (km > 5000) {
      suggestions.push({ name: "Thay mỡ liên kết & nhớt định kỳ", price: 380000 });
    }
    if (km > 10000) {
      suggestions.push({ name: "Thay thế Cốc lọc nhớt bôi trơn", price: 160000 });
    }
    if (km > 20000) {
      suggestions.push({ name: "Vay sinh buồng đốt & Thay lọc gió máy", price: 280000 });
    }
    if (km > 40000) {
      suggestions.push({ name: "Thay Bugi sấy/đánh lửa platinum", price: 650000 });
      suggestions.push({ name: "Thay dầu số / dầu cầu truyền động", price: 950000 });
    }
    if (km > 80000) {
      suggestions.push({ name: "Thay thế xích/dây Đai curoa cam", price: 1400000 });
      suggestions.push({ name: "Rút súc rửa két & Thay nước mát động cơ", price: 450000 });
      suggestions.push({ name: "Gói tổng vệ sinh bảo dưỡng lớn hệ chuyên sâu", price: 4200000 });
    }

    return suggestions;
  };

  const odometerSuggestions = getOdometerSuggestions();

  const applySuggestions = () => {
    const freshItems: ServiceItem[] = odometerSuggestions.map(s => ({
      id: Math.random().toString(36).substr(2, 9),
      name: s.name,
      price: s.price,
      quantity: 1,
      status: 'PENDING',
      timestamp: new Date().toLocaleTimeString('vi-VN') + ' ' + new Date().toLocaleDateString('vi-VN')
    }));

    // Prevent duplicate entries
    const existingNames = formData.detailedServices.map(d => d.name);
    const filteredFresh = freshItems.filter(f => !existingNames.includes(f.name));

    if (filteredFresh.length > 0) {
      setFormData(prev => ({
        ...prev,
        detailedServices: [...prev.detailedServices, ...filteredFresh]
      }));
    }
  };

  // Base64 file uploader logic
  const handlePhotoUpload = (field: keyof VehicleImages, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        const dataUrl = reader.result;
        setFormData(prev => ({
          ...prev,
          vehicleImages: {
            ...prev.vehicleImages,
            [field]: dataUrl
          }
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = (field: keyof VehicleImages) => {
    setFormData(prev => ({
      ...prev,
      vehicleImages: {
        ...prev.vehicleImages,
        [field]: ''
      }
    }));
  };

  const nextStage = () => {
    const stages = Object.values(VehicleStatus);
    const idx = stages.indexOf(formData.status);
    if (idx < stages.length - 1) {
      const nextS = stages[idx + 1];
      setFormData(prev => ({ ...prev, status: nextS }));
      topRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const inputClass = "w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-slate-900 font-semibold text-sm transition-all placeholder:text-slate-400 shadow-sm";
  const labelClass = "block text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1 tracking-wider";

  const renderProgressStepper = () => (
    <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm mb-6 flex justify-between items-center overflow-x-auto gap-4 border border-slate-200 no-scrollbar">
      {Object.values(VehicleStatus).map((s, i) => {
        const isActive = formData.status === s;
        const isPast = Object.values(VehicleStatus).indexOf(formData.status) > i;
        return (
          <div key={s} className={`flex flex-col items-center min-w-[100px] sm:min-w-[120px] gap-2 transition-all duration-300 ${isActive ? 'scale-105' : 'opacity-40'}`}>
            <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm shadow-sm transition-all ${isActive ? 'bg-blue-600 text-white ring-4 ring-blue-50' : isPast ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
              {isPast ? '✓' : i + 1}
            </div>
            <span className={`text-[9px] sm:text-[10px] font-bold uppercase text-center leading-tight whitespace-nowrap tracking-tight ${isActive ? 'text-blue-600' : 'text-slate-900'}`}>{s}</span>
          </div>
        );
      })}
    </div>
  );

  const renderIntake = () => (
    <div className="space-y-8">
      {/* Upper header */}
      <div className="bg-blue-600 p-6 sm:p-10 -mx-4 sm:-mx-12 -mt-4 sm:-mt-12 mb-8 flex flex-col md:flex-row justify-between items-center text-white rounded-b-3xl shadow-lg">
        <div>
          <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight italic text-center md:text-left leading-none">BIÊN BẢN TIẾP NHẬN BÊN TRONG GARA</h1>
          <p className="text-blue-100 text-[10px] font-bold uppercase mt-2 tracking-wide text-center md:text-left">Đăng ký thông tin lịch trình, đo kiểm và lưu giữ hình ảnh</p>
        </div>
        <div className="bg-white/10 p-3 rounded-xl border border-white/20 text-xs font-bold shadow-inner flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto mt-4 md:mt-0">
          <span className="text-white/80 uppercase tracking-widest text-[10px]">Cố vấn Tiếp nhận:</span>
          <input className="bg-transparent border-b border-white/40 outline-none px-2 w-full sm:w-40 font-bold text-white focus:border-white text-sm text-center sm:text-left" value={formData.advisorName} onChange={e=>setFormData({...formData, advisorName: e.target.value})} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Step 1: Vehicle Info */}
        <div className="space-y-6 bg-slate-50/50 p-6 rounded-2xl border border-slate-100 shadow-inner">
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-900 flex items-center gap-2">
            <span className="w-1 h-4 bg-blue-600 rounded-full"></span>
            1. Thông tin xe & Vận hành
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-1"><label className={labelClass}>Biển số xe (*)</label><input value={formData.plateNumber} onChange={e=>setFormData({...formData, plateNumber: e.target.value})} className={inputClass} placeholder="VD: 30A-123.45" /></div>
            <div className="col-span-1"><label className={labelClass}>Hãng sản xuất (*)</label><input value={formData.brand} onChange={e=>setFormData({...formData, brand: e.target.value})} className={inputClass} placeholder="VD: Toyota, Mazda..." /></div>
            <div><label className={labelClass}>Màu xe</label><input value={formData.color} onChange={e=>setFormData({...formData, color: e.target.value})} className={inputClass} /></div>
            <div><label className={labelClass}>Năm sản xuất (*)</label><input value={formData.modelYear} onChange={e=>setFormData({...formData, modelYear: e.target.value})} className={inputClass} /></div>
            <div className="col-span-2"><label className={labelClass}>Tên xe / Model (*)</label><input value={formData.carName} onChange={e=>setFormData({...formData, carName: e.target.value})} className={inputClass} placeholder="VD: Camry, CX-5..." /></div>
            <div className="col-span-2"><label className={labelClass}>Số VIN</label><input value={formData.vin} onChange={e=>setFormData({...formData, vin: e.target.value})} className={inputClass} placeholder="Mã khung xe..." /></div>
            
            <div className="col-span-1">
              <label className={labelClass}>Số odo KM hiện tại (*)</label>
              <input type="number" value={formData.odometer} onChange={e=>setFormData({...formData, odometer: e.target.value})} className="w-full p-3 bg-amber-50/50 border border-amber-200 rounded-xl focus:border-amber-500 outline-none font-mono font-bold text-amber-900 text-sm" placeholder="Nhập số KM..." />
            </div>
            <div className="col-span-1">
              <label className={labelClass}>Ngày vào (*)</label>
              <input type="date" value={formData.dateIn} onChange={e=>setFormData({...formData, dateIn: e.target.value})} className={inputClass} />
            </div>
          </div>

          {/* Rule Engine suggestions popover banner */}
          {odometerSuggestions.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3 shadow-inner">
              <div className="flex gap-2 items-center text-amber-800 text-xs font-bold uppercase tracking-wider">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" /></svg>
                Hệ thống đề xuất bảo dưỡng tự động (Odo {parseInt(formData.odometer).toLocaleString()} KM)
              </div>
              <div className="text-[10px] text-amber-700 leading-relaxed font-medium">
                Dựa trên số hiệu KM của phương tiện, cố vấn dịch vụ nên chuẩn bị hạng mục sau:
                <ul className="list-disc pl-4 mt-1.5 space-y-1 font-semibold">
                  {odometerSuggestions.map((s, i) => (
                    <li key={i}>{s.name} - <span className="font-mono">{s.price.toLocaleString()}đ</span></li>
                  ))}
                </ul>
              </div>
              <button onClick={applySuggestions} type="button" className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all">
                ✓ Áp dụng/Thêm nhanh những gợi ý này
              </button>
            </div>
          )}
        </div>

        {/* Step 2: Customer Info */}
        <div className="space-y-6 bg-slate-50/50 p-6 rounded-2xl border border-slate-100 shadow-inner flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-900 flex items-center gap-2 mb-6">
              <span className="w-1 h-4 bg-blue-600 rounded-full"></span>
              2. Chủ sở hữu & Khách hàng
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-1"><label className={labelClass}>Tên khách hàng (*)</label><input value={formData.customerName} onChange={e=>setFormData({...formData, customerName: e.target.value})} className={inputClass} placeholder="Họ tên chủ xe..." /></div>
              <div className="col-span-1 flex items-end gap-3 p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
                <label className="text-[10px] font-bold uppercase text-slate-500">Giới tính:</label>
                <div className="flex gap-3">
                  <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" checked={formData.gender==='Nam'} onChange={()=>setFormData({...formData, gender:'Nam'})} className="w-4.5 h-4.5 accent-blue-600" /> Nam
                  </label>
                  <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" checked={formData.gender==='Nữ'} onChange={()=>setFormData({...formData, gender:'Nữ'})} className="w-4.5 h-4.5 accent-blue-600" /> Nữ
                  </label>
                </div>
              </div>
              <div className="col-span-2"><label className={labelClass}>Địa chỉ chi tiết</label><input value={formData.address} onChange={e=>setFormData({...formData, address: e.target.value})} className={inputClass} placeholder="Số nhà, tên đường, xã phường..." /></div>
              <div className="col-span-1"><label className={labelClass}>Điện thoại liên hệ (*)</label><input value={formData.phone} onChange={e=>setFormData({...formData, phone: e.target.value})} className={inputClass} placeholder="Số điện thoại di động..." /></div>
              <div className="col-span-1"><label className={labelClass}>Email (nếu có)</label><input type="email" value={formData.email} onChange={e=>setFormData({...formData, email: e.target.value})} className={inputClass} placeholder="Ví dụ: name@gmail.com" /></div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mt-6">
            <span className="text-[10px] font-black text-blue-800 uppercase block mb-1">MỨC NHIÊN LIỆU HIỆN TẠI (F/E):</span>
            <input type="range" min="0" max="100" step="5" value={formData.fuelLevel} onChange={e => setFormData({...formData, fuelLevel: parseInt(e.target.value)})} className="w-full accent-blue-600 cursor-pointer" />
            <div className="flex justify-between text-[10px] font-bold text-blue-500 mt-2">
              <span>E (Cạn)</span>
              <span>Đế: {formData.fuelLevel}%</span>
              <span>F (Đầy)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Vehicle Stage 6 Photo uploader block */}
      <div className="space-y-6 pt-8 border-t border-slate-200">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-900 flex items-center gap-2">
          <span className="w-1.5 h-4 bg-sky-500 rounded-full"></span>
          3. Hồ sơ hình ảnh chi tiết xe (* Bắt buộc để báo giá)
        </h2>
        <p className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Tải hình ảnh trạng thái 6 góc lái để tránh các khiếu nại về sau</p>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {(['front', 'rear', 'left', 'right', 'interior', 'engine'] as (keyof VehicleImages)[]).map(field => {
            const labelMap: Record<string, string> = {
              front: 'Đầu xe',
              rear: 'Đuôi xe',
              left: 'Sườn trái',
              right: 'Sườn phải',
              interior: 'Nội thất',
              engine: 'Khoang máy'
            };
            const currentImg = formData.vehicleImages?.[field];

            return (
              <div key={field} className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-4 flex flex-col items-center justify-between shadow-sm relative aspect-square group hover:border-blue-500 transition-all">
                {currentImg ? (
                  <div className="w-full h-full relative overflow-hidden rounded-xl">
                    <img src={currentImg} alt={labelMap[field]} className="w-full h-full object-cover" />
                    <button type="button" onClick={() => removePhoto(field)} className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-1.5 rounded-full shadow transition-all">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                    <div className="absolute bottom-0 inset-x-0 bg-slate-900/60 p-1 text-center text-[10px] text-white font-bold uppercase font-mono">
                      {labelMap[field]}
                    </div>
                  </div>
                ) : (
                  <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer gap-2 my-auto">
                    <svg className="w-10 h-10 text-slate-300 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    <span className="text-[10px] font-black text-slate-400 group-hover:text-blue-600 transition-colors uppercase tracking-tight">{labelMap[field]}</span>
                    <input type="file" accept="image/*" onChange={(e) => handlePhotoUpload(field, e)} className="hidden" />
                  </label>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Survey & Exterior checking checklist */}
      <div className="space-y-6 pt-8 border-t border-slate-200">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-900 flex items-center gap-2">
          <span className="w-1.5 h-4 bg-teal-500 rounded-full"></span>
          4. Khảo sát hiện trạng ngoại thất & Đồ dùng
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {INTERIOR_SURVEY_ITEMS.concat(CONDITION_ITEMS).map(item => (
            <div key={item.key} className="bg-white p-4 rounded-xl flex flex-col gap-3 border border-slate-200 shadow-sm">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-tight">{item.label}</span>
              <div className="flex gap-2">
                {item.options.map(o => (
                  <label key={o} className={`flex items-center gap-2 text-[10px] font-black uppercase px-3 py-2 rounded-lg border transition-all cursor-pointer flex-1 justify-center ${formData.interiorSurvey[item.key] === o || formData.condition[item.key] === o ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-blue-500'}`}>
                    <input type="radio" checked={formData.interiorSurvey[item.key] === o || formData.condition[item.key] === o} 
                      onChange={()=>{
                        if (INTERIOR_SURVEY_ITEMS.find(i=>i.key === item.key)) setFormData({...formData, interiorSurvey: {...formData.interiorSurvey, [item.key]: o}});
                        else setFormData({...formData, condition: {...formData.condition, [item.key]: o}});
                      }} 
                    className="hidden" /> 
                    {o}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Manual service entries inputting proposal */}
      <div className="bg-white p-6 sm:p-10 rounded-3xl border border-slate-200 shadow-sm">
        <h2 className="text-base font-bold text-slate-900 uppercase tracking-tight flex items-center gap-2 mb-8 border-b border-rose-50 pb-4">
          <span className="w-1 h-4 bg-red-600 rounded-full"></span>
          5. Dự toán kế hoạch thi công bảo hiểm & dịch vụ
        </h2>

        <div className="space-y-3">
          {formData.detailedServices.length > 0 ? formData.detailedServices.map((item) => (
            <div key={item.id} className="grid grid-cols-12 gap-3 items-center bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-inner">
              <div className="col-span-12 md:col-span-6">
                <input value={item.name} onChange={e => setFormData({...formData, detailedServices: formData.detailedServices.map(s => s.id === item.id ? {...s, name: e.target.value} : s)})} className="w-full bg-transparent border-b border-slate-300 focus:border-blue-500 outline-none font-bold text-slate-900 text-sm uppercase" placeholder="Nhập tên phụ tùng / gói dịch vụ..." />
              </div>
              <div className="col-span-6 md:col-span-3">
                <div className="relative">
                  <input type="number" value={item.price} onChange={e => setFormData({...formData, detailedServices: formData.detailedServices.map(s => s.id === item.id ? {...s, price: parseInt(e.target.value) || 0} : s)})} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-right font-bold text-emerald-600 text-sm font-mono" />
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[8px] font-bold text-slate-400 uppercase">Đơn giá</span>
                </div>
              </div>
              <div className="col-span-4 md:col-span-2">
                 <div className="relative">
                  <input type="number" value={item.quantity} onChange={e => setFormData({...formData, detailedServices: formData.detailedServices.map(s => s.id === item.id ? {...s, quantity: parseInt(e.target.value) || 1} : s)})} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-center font-bold text-slate-900 text-sm" />
                  <span className="absolute left-1.5 top-0.5 text-[7px] font-bold text-slate-400 uppercase">SL</span>
                 </div>
              </div>
              <div className="col-span-2 md:col-span-1 text-right">
                <button type="button" onClick={() => setFormData({...formData, detailedServices: formData.detailedServices.filter(s => s.id !== item.id)})} className="text-slate-400 hover:text-red-500 transition-colors p-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            </div>
          )) : (
            <div className="text-center py-10 text-slate-400 font-bold uppercase border-2 border-dashed border-slate-200 rounded-2xl text-[10px] bg-slate-50">Chưa tải hay kê lập hạng mục bảo trì nào</div>
          )}
          <button 
            type="button" 
            onClick={() => setFormData({...formData, detailedServices: [...formData.detailedServices, { id: Math.random().toString(36).substr(2,9), name: '', price: 0, quantity: 1, status: 'PENDING' }]})}
            className="w-full py-4 border border-dashed border-slate-300 rounded-2xl text-slate-400 font-bold uppercase text-[10px] tracking-widest hover:bg-slate-50 hover:border-blue-500 hover:text-blue-600 transition-all cursor-pointer"
          >
            + Chèn thêm hạng mục sửa chữa
          </button>
        </div>

        {/* Finance and receipt totalization */}
        <div className="mt-8 border-t border-slate-100 pt-6 flex flex-col md:flex-row gap-4 justify-between items-end">
          <div className="grid grid-cols-2 gap-4 w-full md:w-1/2">
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase">Khấu trừ giảm giá (đ)</label>
              <input type="number" value={formData.discount} onChange={e=>setFormData({...formData, discount: parseInt(e.target.value) || 0})} className={inputClass} />
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase">Sở suất Thuế (%)</label>
              <input type="number" value={formData.tax} onChange={e=>setFormData({...formData, tax: parseInt(e.target.value) || 0})} className={inputClass} />
            </div>
          </div>
          <div className="text-right text-xs font-semibold text-slate-600 uppercase">
            Tổng giá trị thanh toán ước tính:
            <span className="block text-2xl font-black text-emerald-600 font-mono mt-1">{(formData.totalAmount || 0).toLocaleString()}đ</span>
          </div>
        </div>

        {/* Advisor & Client digital signatures */}
        <div className="mt-12 flex flex-col md:flex-row items-center justify-around gap-8 pt-8 border-t border-slate-100">
          <div className="flex flex-col items-center">
            <SignaturePad label="1. Chữ ký Cố vấn dịch vụ" onSave={sig=>setFormData({...formData, advisorSignature: sig})} />
            <p className="text-[9px] font-bold text-slate-400 uppercase mt-4">Ký nhận biên bảo kê khai</p>
          </div>
          <div className="flex flex-col items-center">
            <SignaturePad label="2. Chữ ký xác nhận Khách hàng" onSave={sig=>setFormData({...formData, intakeSignature: sig})} />
            <p className="text-[9px] font-bold text-slate-400 uppercase mt-4">Cam đoan đồng thuận bàn giao</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderExecuting = () => (
    <div className="space-y-8 animate-in slide-in-from-right duration-500">
      <div className="bg-amber-500 p-8 -mx-4 sm:-mx-12 -mt-4 sm:-mt-12 text-white rounded-b-3xl shadow-lg flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black uppercase italic tracking-tight leading-none">THỜI CÔNG THI CÔNG KỸ THUẬT</h1>
          <p className="text-[10px] font-bold text-amber-100 mt-2 uppercase tracking-widest">Kỹ thuật viên thay đổi trạng thái và ghi lập thời điểm</p>
        </div>
        <div className="bg-white/20 px-6 py-3 rounded-xl border border-white/30 font-bold text-xl text-white shadow-inner font-mono">{formData.plateNumber}</div>
      </div>

      <div className="space-y-6">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-900 flex items-center gap-2">
          <span className="w-1 h-4 bg-amber-500 rounded-full"></span>
          Check-list tiến độ phụ tùng
        </h2>
        
        <div className="grid grid-cols-1 gap-4">
          {formData.detailedServices.map(item => {
            const updateItemStatus = (newS: 'PENDING' | 'EXECUTING' | 'DONE') => {
              const rightNow = new Date().toLocaleTimeString('vi-VN') + ' | ' + new Date().toLocaleDateString('vi-VN');
              setFormData({
                ...formData,
                detailedServices: formData.detailedServices.map(s => s.id === item.id ? {
                  ...s,
                  status: newS,
                  isDone: newS === 'DONE',
                  timestamp: rightNow
                } : s)
              });
            };

            return (
              <div key={item.id} className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all">
                <div className="flex-1 w-full">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base sm:text-lg font-bold text-slate-900 uppercase tracking-tight leading-none">{item.name}</span>
                    <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase font-mono ${
                      item.status === 'DONE' ? 'bg-emerald-100 text-emerald-800' :
                      item.status === 'EXECUTING' ? 'bg-blue-100 text-blue-800 animate-pulse' :
                      'bg-slate-100 text-slate-500'
                    }`}>
                      {item.status === 'DONE' ? 'Hoàn thành' : item.status === 'EXECUTING' ? 'Đang làm' : 'Chưa làm'}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4 mt-2.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Số lượng: <span className="font-mono text-slate-800 bg-slate-50 px-1.5 py-0.5 rounded-md border border-slate-200">{item.quantity}</span></span>
                    {item.timestamp && (
                      <span className="text-[10px] font-semibold text-blue-600">
                        ⏱ Thay đổi gần nhất: <span className="font-bold">{item.timestamp}</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 w-full md:w-auto">
                  <button type="button" onClick={() => updateItemStatus('PENDING')} className={`flex-1 md:flex-initial px-4 py-2.5 rounded-xl text-[9px] font-bold uppercase tracking-wider border transition-all ${item.status === 'PENDING' ? 'bg-slate-200 text-slate-800 border-slate-300' : 'bg-slate-50 text-slate-500 hover:border-slate-300'}`}>
                    Nháp
                  </button>
                  <button type="button" onClick={() => updateItemStatus('EXECUTING')} className={`flex-1 md:flex-initial px-4 py-2.5 rounded-xl text-[9px] font-bold uppercase tracking-wider border transition-all ${item.status === 'EXECUTING' ? 'bg-blue-600 text-white border-blue-700 shadow-md' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}>
                    Đang làm
                  </button>
                  <button type="button" onClick={() => updateItemStatus('DONE')} className={`flex-1 md:flex-initial px-4 py-2.5 rounded-xl text-[9px] font-bold uppercase tracking-wider border transition-all ${item.status === 'DONE' ? 'bg-emerald-600 text-white border-emerald-700 shadow-md' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}>
                    Hoàn thành
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-slate-900 p-8 rounded-3xl text-white shadow-lg">
        <label className="block text-[10px] font-bold uppercase text-amber-500 mb-4 tracking-widest italic">Sổ nhật trình Kỹ sư trưởng & lỗi phát sinh:</label>
        <textarea value={formData.techNotes} onChange={e=>setFormData({...formData, techNotes: e.target.value})} rows={6} className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-white font-semibold text-sm outline-none focus:border-amber-500 transition-all placeholder:text-slate-700 font-mono" placeholder="Ghi nhận lỗi, hư hại phát hiện trong thời hạn nâng hạ gầm máy tại đây..." />
      </div>
    </div>
  );

  const renderTechCheck = () => (
    <div className="space-y-8 animate-in zoom-in duration-500">
      <div className="bg-indigo-600 p-8 -mx-4 sm:-mx-12 -mt-4 sm:-mt-12 text-white rounded-b-3xl shadow-lg">
        <h1 className="text-xl sm:text-2xl font-black uppercase italic tracking-tight leading-none">KIỂM DUYỆT CHẤT LƯỢNG AN TOÀN (QC)</h1>
        <p className="text-[10px] font-bold text-indigo-100 mt-2 uppercase tracking-widest">Nghiệm thu chạy thử vận hành trước khi liên hệ bàn giao</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-900 mb-6 flex items-center gap-2">
            <span className="w-1 h-4 bg-indigo-600 rounded-full"></span>
            Kết quả nghiệm định dịch vụ
          </h2>
          <div className="space-y-3">
            {formData.detailedServices.map(s => (
              <div key={s.id} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${s.status === 'DONE' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200 shadow-sm animate-pulse'}`}>
                <span className="text-sm font-bold text-slate-900 uppercase italic leading-tight">{s.name}</span>
                <span className={`px-4 py-1 rounded-lg text-[9px] font-black uppercase shadow-sm ${s.status === 'DONE' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
                  {s.status === 'DONE' ? 'Đạt QC ✓' : 'Chưa xong !'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900 p-8 rounded-3xl shadow-lg text-white flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-white mb-6 flex items-center gap-2">
              <span className="w-1 h-4 bg-indigo-500 rounded-full"></span>
              Sổ tay ký nhận QC trưởng:
            </h2>
            <textarea 
              value={formData.techNotes} 
              onChange={e=>setFormData({...formData, techNotes: e.target.value})} 
              rows={8} 
              className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-white font-semibold outline-none focus:border-indigo-500 transition-all text-sm font-mono" 
              placeholder="Ghi nhận nhật trình chạy thử, độ rung phanh lái hoặc áp suất nạp khí ổn định..."
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderHandover = () => (
    <div className="space-y-8 animate-in slide-in-from-bottom duration-500">
      <div className="bg-emerald-600 p-8 -mx-4 sm:-mx-12 -mt-4 sm:-mt-12 text-white rounded-b-3xl shadow-lg">
        <h1 className="text-xl sm:text-2xl font-black uppercase italic tracking-tight leading-none">BÀN GIAO & QUYẾT TOÁN</h1>
        <p className="text-[10px] font-bold text-emerald-100 mt-2 uppercase tracking-widest">Đo hoàn thành bàn giao chìa khóa cho đại diện chủ sở hữu</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center">
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-900 mb-8 self-start flex items-center gap-2">
            <span className="w-1 h-4 bg-emerald-600 rounded-full"></span>
            3. Chữ ký Khách hàng nhận xe
          </h2>
          <SignaturePad label="Chữ ký xác minh hoàn thành" onSave={sig=>setFormData({...formData, handoverSignature: sig})} />
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest text-center mt-6 italic">Xác nhận hài lòng chi tiết phụ tùng bảo hành đã lắp ráp</p>
        </div>

        <div className="bg-slate-50 p-8 rounded-3xl border border-slate-200 shadow-inner flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-900 mb-6 flex items-center gap-2 border-b pb-2">
              <span className="w-1 h-4 bg-emerald-600 rounded-full"></span>
              Phụ lục quyết toán
            </h2>
            <div className="space-y-3">
              {formData.detailedServices.map(s => (
                <div key={s.id} className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-bold uppercase">{s.name} x{s.quantity}</span>
                  <span className="text-slate-900 font-mono font-bold">{(s.price * s.quantity).toLocaleString()}đ</span>
                </div>
              ))}
              <div className="pt-4 mt-6 border-t border-slate-200 flex justify-between items-center">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Tổng cộng:</span>
                <span className="text-slate-900 font-mono font-black">{formData.detailedServices.reduce((a, b) => a + (b.price * b.quantity), 0).toLocaleString()}đ</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Đã giảm trừ:</span>
                <span className="text-red-500 font-mono font-bold">-{formData.discount.toLocaleString()}đ</span>
              </div>
              <div className="flex justify-between items-center text-xs border-b pb-4">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Thuế VAT:</span>
                <span className="text-slate-900 font-semibold">{formData.tax}%</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-base font-black uppercase text-slate-900 italic">Tổng quyết toán:</span>
                <span className="text-2xl font-black text-emerald-600 font-mono">{(formData.totalAmount || 0).toLocaleString()}đ</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto pb-20">
      {/* Top action header */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <button onClick={onCancel} className="flex items-center gap-2 text-slate-400 hover:text-slate-950 font-bold uppercase text-[10px] tracking-widest transition-colors cursor-pointer">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
          Quay lại tiến độ
        </button>

        <div className="flex gap-2 md:gap-3 flex-wrap">
          {/* A4 PRINT AND EXPORT CONTROL BUTTONS */}
          <button type="button" onClick={() => setActivePrint('INTAKE')} className="px-5 py-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl font-bold uppercase text-[9px] tracking-widest shadow-sm transition-all cursor-pointer flex items-center gap-1.5">
            <svg className="w-4 h-4 border border-current rounded p-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4" /></svg>
            In Phiếu Tiếp Nhận
          </button>
          
          {(formData.status === VehicleStatus.HANDOVER || formData.status === VehicleStatus.COMPLETED) && (
            <button type="button" onClick={() => setActivePrint('HANDOVER')} className="px-5 py-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl font-bold uppercase text-[9px] tracking-widest shadow-sm transition-all cursor-pointer flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              In Phiếu Bàn Giao
            </button>
          )}

          <button onClick={()=>onSave(formData)} className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold uppercase text-[9px] tracking-widest rounded-xl transition-all shadow-sm">Lưu nháp</button>
          
          {canEdit && formData.status !== VehicleStatus.COMPLETED && (
            <button onClick={nextStage} className="px-7 py-3 bg-blue-600 text-white rounded-xl font-bold uppercase text-[9px] tracking-widest hover:bg-blue-700 transition-all shadow-md transform active:scale-95 cursor-pointer">
              {formData.status === VehicleStatus.HANDOVER ? 'Hoàn tất Quyết toán ✓' : 'Tiếp theo →'}
            </button>
          )}
        </div>
      </div>

      {renderProgressStepper()}

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-4 sm:p-12 overflow-hidden">
        {formData.status === VehicleStatus.INTAKE && renderIntake()}
        {formData.status === VehicleStatus.EXECUTING && renderExecuting()}
        {formData.status === VehicleStatus.TECH_CHECK && renderTechCheck()}
        {formData.status === VehicleStatus.HANDOVER && renderHandover()}
        
        {formData.status === VehicleStatus.COMPLETED && (
          <div className="flex flex-col items-center justify-center py-20 animate-in fade-in zoom-in duration-700">
            <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mb-8 shadow-inner">
              <svg className="w-12 h-12 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
            </div>
            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight italic mb-4 text-center">Hồ sơ đã hoàn tất quyết toán</h1>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[9px] mb-12 text-center text-xs">Phương tiện đã được sửa xong và rời khỏi Bên Trong Gara</p>
            <div className="flex gap-4">
              <button type="button" onClick={() => setActivePrint('HANDOVER')} className="px-8 py-4 bg-white border border-slate-300 text-slate-700 rounded-2xl font-bold uppercase text-xs tracking-widest hover:bg-slate-50 transition-all shadow shadow-sm cursor-pointer">
                Xuất lại PDF quyết hóa đơn
              </button>
              <button onClick={onCancel} className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold uppercase text-xs tracking-widest hover:bg-blue-600 transition-all shadow-lg transform active:scale-95 cursor-pointer">Quay lại quản lý xe</button>
            </div>
          </div>
        )}
      </div>

      {/* RENDER MODAL PRINT OVERLAY WITH REALTIME PREVIEW */}
      {activePrint && (
        <PrintTemplate form={formData} type={activePrint} onClose={() => setActivePrint(null)} />
      )}
    </div>
  );
};

export default IntakeFormView;
