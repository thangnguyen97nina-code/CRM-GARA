import React, { useRef } from 'react';
import { IntakeForm, VehicleStatus } from '../types';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface PrintTemplateProps {
  form: IntakeForm;
  type: 'INTAKE' | 'HANDOVER';
  onClose: () => void;
}

const PrintTemplate: React.FC<PrintTemplateProps> = ({ form, type, onClose }) => {
  const printRef = useRef<HTMLDivElement>(null);

  const LOGO_URL = "https://asiacar.vn/upload/filemanager/files/logo-qt.png";

  const exportPDF = async () => {
    const element = printRef.current;
    if (!element) return;

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210; // A4 width
      const pageHeight = 295; // A4 height
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const fileName = type === 'INTAKE' 
        ? `Phieu_Tiep_Nhan_${form.orderCode}_${form.plateNumber}.pdf`
        : `Phieu_Ban_Giao_${form.orderCode}_${form.plateNumber}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error("Export PDF failed:", error);
      alert("Đã xảy ra lỗi khi tạo tệp PDF. Bạn có thể sử dụng nút 'In Trực Tiếp (A4)' để thay thế.");
    }
  };

  const directPrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex flex-col justify-between p-4 sm:p-8 overflow-y-auto no-scrollbar">
      {/* Action Bar */}
      <div className="max-w-4xl w-full mx-auto bg-slate-900 text-white p-4 rounded-t-3xl flex flex-wrap gap-4 items-center justify-between border-b border-slate-800 shadow-xl">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-xs font-bold uppercase tracking-wider">
            Xem trước hóa đơn A4 ({type === 'INTAKE' ? 'Tiếp Nhận' : 'Bàn Giao'})
          </span>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all">
            Hủy / Đóng
          </button>
          <button onClick={directPrint} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all shadow-md">
            In Trực Tiếp (A4)
          </button>
          <button onClick={exportPDF} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all shadow-md">
            Tải PDF
          </button>
        </div>
      </div>

      {/* A4 Content Sheet Wrapper */}
      <div className="flex-1 max-w-4xl w-full mx-auto bg-white p-4 sm:p-12 border-x border-slate-200 shadow-2xl overflow-x-auto">
        <div ref={printRef} className="w-[790px] mx-auto bg-white p-8 text-slate-900 border border-slate-100 print:w-full print:border-none print:p-0 font-sans" style={{ minHeight: '1120px' }}>
          
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-6">
            <div className="flex items-center gap-4">
              <img src={LOGO_URL} alt="Logo" className="w-[60px] h-[60px] object-contain" />
              <div>
                <h1 className="text-xl font-bold tracking-tight uppercase leading-none text-slate-950">BÊN TRONG GARA</h1>
                <p className="text-[9px] text-slate-500 uppercase font-bold tracking-widest mt-1">Đường 454, An Đô, Thái Bình</p>
                <p className="text-[9px] text-slate-400 font-semibold">Hotline: 0988.123.456 | bentronggara.vn</p>
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-lg font-black text-slate-900 tracking-tight font-mono">{form.orderCode}</h2>
              <p className="text-[9px] font-extrabold text-blue-600 uppercase tracking-widest mt-1">
                {type === 'INTAKE' ? 'PHIẾU TIẾP NHẬN XE' : 'HÓA ĐƠN BÀN GIAO'}
              </p>
              <p className="text-[8px] text-slate-400 font-semibold mt-0.5">Ngày lập: {new Date(form.createdAt).toLocaleDateString('vi-VN')}</p>
            </div>
          </div>

          <div className="text-center mb-8">
            <h2 className="text-xl font-black text-slate-950 uppercase tracking-wide">
              {type === 'INTAKE' ? 'BIÊN BẢN TIẾP NHẬN VÀ KHẢO SÁT XE' : 'PHIẾU QUYẾT TOÁN & BÀN GIAO XE BÊN TRONG GARA'}
            </h2>
            <div className="w-16 h-1 bg-slate-950 mx-auto mt-2"></div>
          </div>

          {/* Customer & Vehicle Info Grid */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-wider mb-2">I. THÔNG TIN KHÁCH HÀNG</h3>
              <div className="space-y-1 text-xs">
                <p><span className="text-slate-400 font-semibold">Họ và tên:</span> <span className="font-bold text-slate-900 uppercase">{form.customerName || 'N/A'}</span></p>
                <p><span className="text-slate-400 font-semibold">Điện thoại:</span> <span className="font-bold text-slate-900 font-mono">{form.phone}</span></p>
                <p><span className="text-slate-400 font-semibold">Email:</span> <span className="font-medium text-slate-700">{form.email || 'N/A'}</span></p>
                <p><span className="text-slate-400 font-semibold">Địa chỉ:</span> <span className="font-medium text-slate-700">{form.address || 'N/A'}</span></p>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-wider mb-2">II. THÔNG TIN PHƯƠNG TIỆN</h3>
              <div className="space-y-1 text-xs">
                <p><span className="text-slate-400 font-semibold">Biển số kiểm soát:</span> <span className="font-black text-slate-950 font-mono text-sm bg-white border border-slate-200 px-1.5 py-0.5 rounded uppercase">{form.plateNumber}</span></p>
                <p><span className="text-slate-400 font-semibold">Hiệu xe / Model:</span> <span className="font-bold text-slate-900 uppercase">{form.brand} {form.carName}</span></p>
                <p><span className="text-slate-400 font-semibold">Đời xe / VIN:</span> <span className="font-medium font-mono text-slate-700">{form.modelYear || 'N/A'} • {form.vin || 'N/A'}</span></p>
                <p><span className="text-slate-400 font-semibold">Số Km hiện tại:</span> <span className="font-bold text-slate-900 font-mono bg-amber-50 text-amber-800 px-1 rounded">{Number(form.odometer).toLocaleString()} KM</span></p>
              </div>
            </div>
          </div>

          {/* Checklist Surveys section (Intake Only) */}
          {type === 'INTAKE' && (
            <div className="mb-8">
              <h3 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-3 border-l-4 border-slate-900 pl-2">
                III. KẾT QUẢ KHẢO SÁT & HIỆN TRẠNG NGOẠI THẤT
              </h3>
              <div className="grid grid-cols-3 gap-3 text-[10px] bg-slate-50 p-4 rounded-2xl border border-slate-100">
                {Object.entries(form.condition || {}).map(([key, val]) => (
                  <div key={key} className="flex justify-between border-b border-dashed border-slate-200 pb-1.5">
                    <span className="text-slate-500 font-semibold uppercase tracking-tight">{key}:</span>
                    <span className={`font-bold uppercase ${val === 'Xước' || val === 'Hỏng' ? 'text-red-500' : 'text-slate-900'}`}>{val}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Concrete list of Services & Items */}
          <div className="mb-8">
            <h3 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-3 border-l-4 border-slate-900 pl-2">
              {type === 'INTAKE' ? 'IV. NỘI DUNG YÊU CẦU / KẾ HOẠCH SỬA CHỮA' : 'III. BẢNG QUYẾT TOÁN CHI PHÍ SỬA CHỮA BẢO DƯỠNG'}
            </h3>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-white font-bold uppercase tracking-wider">
                  <th className="p-2.5 rounded-l-lg text-[9px]">STT</th>
                  <th className="p-2.5 text-[9px]">Tên dịch vụ - Hạng mục phụ tùng</th>
                  <th className="p-2.5 text-center text-[9px]">SL</th>
                  <th className="p-2.5 text-right text-[9px]">Đơn giá</th>
                  <th className="p-2.5 text-right rounded-r-lg text-[9px]">Thành tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {form.detailedServices.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="p-2.5 font-bold text-slate-400">{idx + 1}</td>
                    <td className="p-2.5 font-bold text-slate-900 uppercase">{item.name || 'Hạng mục dịch vụ'}</td>
                    <td className="p-2.5 text-center font-bold text-slate-600 font-mono">{item.quantity}</td>
                    <td className="p-2.5 text-right font-medium text-slate-700 font-mono">{item.price.toLocaleString()}đ</td>
                    <td className="p-2.5 text-right font-bold text-slate-900 font-mono">{(item.price * item.quantity).toLocaleString()}đ</td>
                  </tr>
                ))}
                {form.detailedServices.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400 font-extrabold uppercase text-[10px] tracking-widest">
                      Chưa ghi nhận hạng mục sửa chữa
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Financial Summary */}
            <div className="mt-4 flex flex-col items-end space-y-1.5 text-xs">
              <div className="flex justify-between w-[260px] text-slate-500 font-bold">
                <span>Tổng chi phí:</span>
                <span className="font-mono text-slate-900">{form.detailedServices.reduce((a, b) => a + (b.price * b.quantity), 0).toLocaleString()}đ</span>
              </div>
              <div className="flex justify-between w-[260px] text-slate-500 font-bold">
                <span>Giảm giá:</span>
                <span className="font-mono text-red-500">-{form.discount.toLocaleString()}đ</span>
              </div>
              <div className="flex justify-between w-[260px] text-slate-500 font-bold border-b border-slate-200 pb-2">
                <span>Thuế VAT:</span>
                <span className="font-mono text-slate-900">{form.tax}%</span>
              </div>
              <div className="flex justify-between w-[260px] text-slate-900 font-black text-sm pt-1">
                <span>TỔNG TIỀN THANH TOÁN:</span>
                <span className="font-mono text-blue-600 text-base">{form.totalAmount.toLocaleString()}đ</span>
              </div>
            </div>
          </div>

          {/* Vehicle Images Attachment Showcase */}
          {form.vehicleImages && Object.values(form.vehicleImages).some(Boolean) && (
            <div className="mb-8">
              <h3 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-3 border-l-4 border-slate-900 pl-2">
                {type === 'INTAKE' ? 'V. HÌNH ẢNH TRẠNG THÁI TIẾP NHẬN BÀN GIAO' : 'IV. HÌNH ẢNH TRƯỚC VÀ SAU KHI SỬA CHỮA THI CÔNG'}
              </h3>
              <div className="grid grid-cols-6 gap-2">
                {Object.entries(form.vehicleImages).map(([label, url]) => {
                  if (!url) return null;
                  const viLabels: Record<string, string> = {
                    front: 'Đầu xe',
                    rear: 'Đuôi xe',
                    left: 'Bên trái',
                    right: 'Bên phải',
                    interior: 'Nội thất',
                    engine: 'Khoang máy'
                  };
                  return (
                    <div key={label} className="col-span-1 rounded-xl overflow-hidden border border-slate-200 aspect-square relative bg-slate-50 flex flex-col justify-between">
                      <img src={url} alt={label} className="w-full h-full object-cover" />
                      <div className="absolute bottom-0 inset-x-0 bg-slate-900/40 text-white text-[8px] font-black uppercase tracking-wider text-center py-0.5">
                        {viLabels[label]}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Printable Signature block with QR Code and scan info */}
          <div className="grid grid-cols-12 gap-4 mt-12 pt-6 border-t border-slate-200">
            {/* Left side: QR Validation code */}
            <div className="col-span-4 flex items-center gap-3">
              {/* Stylized highcontrast QR indicator block representing unique validation link */}
              <div className="w-16 h-16 border-2 border-slate-900 p-1 flex items-center justify-center bg-white flex-shrink-0">
                <svg className="w-full h-full text-slate-950" viewBox="0 0 24 24" fill="currentColor">
                  {/* High quality abstract QR pattern */}
                  <path d="M1 1h4v4H1V1zm0 6h4v4H1V7zm0 6h4v4H1v-4zm6-12h4v4H7V1zm0 6h4v4H7V7zm6-6h4v4h-4V1zm6 0h4v4h-4V1zm-4 6h4v4h-4V7zm6 0h4v4h-4V7zM1 19h4v4H1v-4zm6 0h4v4H7v-4zm6 0h4v4h-4v-4zm6 0h4v4h-4v-4zm-6-6h4v4h-4v-4zm6 0h4v4h-4v-4z" />
                </svg>
              </div>
              <div>
                <span className="text-[8px] font-black text-slate-800 uppercase block tracking-wider leading-none">Mã quản lý xe:</span>
                <span className="text-[10px] font-black text-slate-900 font-mono mt-1 block tracking-tight">{form.orderCode}</span>
                <p className="text-[7px] text-slate-400 font-medium leading-tight mt-0.5">Quét mã QR để kiểm tra hóa đơn điện tử chính chủ tại hệ thống</p>
              </div>
            </div>

            {/* Right side: Mapped manual signatures */}
            <div className="col-span-8 grid grid-cols-2 text-center text-xs">
              <div className="flex flex-col items-center">
                <span className="font-bold text-slate-900 uppercase text-[9px] tracking-wider">CỐ VẤN DỊCH VỤ</span>
                <span className="text-[8px] text-slate-400 italic">Ký và ghi rõ họ tên</span>
                {form.advisorSignature ? (
                  <img src={form.advisorSignature} alt="Advisor Sig" className="h-12 object-contain my-2" />
                ) : (
                  <div className="h-12 w-1"></div>
                )}
                <span className="font-bold text-slate-950 uppercase mt-2 text-[10px]">{form.advisorName}</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="font-bold text-slate-900 uppercase text-[9px] tracking-wider">ĐẠI DIỆN KHÁCH HÀNG</span>
                <span className="text-[8px] text-slate-400 italic">Xác nhận đồng ý thi công</span>
                {type === 'INTAKE' && form.intakeSignature ? (
                  <img src={form.intakeSignature} alt="Intake Sig" className="h-12 object-contain my-2" />
                ) : type === 'HANDOVER' && form.handoverSignature ? (
                  <img src={form.handoverSignature} alt="Handover Sig" className="h-12 object-contain my-2" />
                ) : (
                  <div className="h-12 w-1"></div>
                )}
                <span className="font-bold text-slate-950 uppercase mt-2 text-[10px]">{form.customerName}</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default PrintTemplate;
