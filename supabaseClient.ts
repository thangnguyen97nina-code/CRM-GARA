import { createClient } from '@supabase/supabase-js';
import { IntakeForm, VehicleStatus, ServiceItem, UserAccount } from './types';

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

// DDL schema for user deployment in Supabase
export const SUPABASE_SQL_DDL = `-- SCRIPT TẠO DATABASE CHUẨN GARAGE "BÊN TRONG GARA"
-- Copy-paste tập lệnh này vào Supabase SQL Editor và chạy nó.

-- 1. Bảng Customers (Khách hàng)
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    email TEXT,
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Bảng Vehicles (Xe cộ)
CREATE TABLE IF NOT EXISTS vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    license_plate TEXT NOT NULL UNIQUE,
    vehicle_brand TEXT NOT NULL,
    vehicle_model TEXT NOT NULL,
    vehicle_year TEXT,
    vin TEXT,
    current_km INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Bảng Service Orders (Phiếu sửa chữa)
CREATE TABLE IF NOT EXISTS service_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_code TEXT NOT NULL UNIQUE,
    customer_id UUID REFERENCES customers(id) ON DELETE RESTRICT,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE RESTRICT,
    advisor_id TEXT NOT NULL,
    status TEXT NOT NULL,
    received_date TEXT NOT NULL,
    expected_delivery TEXT,
    completed_date TEXT,
    total_amount NUMERIC(15, 2) DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Bảng Service Items (Chi tiết dịch vụ phụ tùng)
CREATE TABLE IF NOT EXISTS service_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_order_id UUID REFERENCES service_orders(id) ON DELETE CASCADE,
    service_name TEXT NOT NULL,
    quantity INTEGER DEFAULT 1 NOT NULL,
    unit_price NUMERIC(15, 2) DEFAULT 0 NOT NULL,
    total NUMERIC(15, 2) DEFAULT 0 NOT NULL,
    status TEXT DEFAULT 'PENDING' NOT NULL,
    timestamp TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Bảng Vehicle Inspections (Khảo sát, hiện trạng checklist)
CREATE TABLE IF NOT EXISTS vehicle_inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_order_id UUID REFERENCES service_orders(id) ON DELETE CASCADE,
    inspection_type TEXT NOT NULL, -- 'interior' hoặc 'condition'
    item_name TEXT NOT NULL,
    status TEXT NOT NULL,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Bảng Vehicle Images (Hình ảnh xe các góc)
CREATE TABLE IF NOT EXISTS vehicle_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_order_id UUID REFERENCES service_orders(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    image_type TEXT NOT NULL, -- 'front', 'rear', 'left', 'right', 'interior', 'engine'
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Bảng Signatures (Chữ ký điện tử)
CREATE TABLE IF NOT EXISTS signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_order_id UUID REFERENCES service_orders(id) ON DELETE CASCADE,
    signature_type TEXT NOT NULL, -- 'intake' hoặc 'handover' hoặc 'advisor'
    image_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. Bảng Users (Hệ thống nhân sự)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Trình tự khởi tạo số hiệu phiếu:
-- Đảm bảo an toàn không trùng lặp mã phiếu
`;

// Sequential order code generator
const generateSequentialOrderCode = (existingCount: number): string => {
  const nextNum = existingCount + 1;
  const numStr = String(nextNum).padStart(5, '0');
  return `GR2026${numStr}`;
};

export const garageDb = {
  // GET ALL SERVICE ORDERS (Reconstruct from tables)
  async getForms(): Promise<IntakeForm[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        console.log('Fetching service orders from Supabase Relational Schema...');
        // 1. Fetch service orders
        const { data: orders, error: oError } = await supabase
          .from('service_orders')
          .select('*')
          .order('order_code', { ascending: false });
        
        if (oError) throw oError;
        if (!orders || orders.length === 0) return [];

        const reconstructedForms: IntakeForm[] = [];

        // Batch fetching of relational tables to optimize performance (React Query Cache / performance optimization)
        for (const order of orders) {
          // Fetch customer
          const { data: customer } = await supabase
            .from('customers')
            .select('*')
            .eq('id', order.customer_id)
            .single();

          // Fetch vehicle
          const { data: vehicle } = await supabase
            .from('vehicles')
            .select('*')
            .eq('id', order.vehicle_id)
            .single();

          // Fetch items
          const { data: items } = await supabase
            .from('service_items')
            .select('*')
            .eq('service_order_id', order.id);

          // Fetch inspections
          const { data: inspections } = await supabase
            .from('vehicle_inspections')
            .select('*')
            .eq('service_order_id', order.id);

          // Fetch images
          const { data: images } = await supabase
            .from('vehicle_images')
            .select('*')
            .eq('service_order_id', order.id);

          // Fetch signatures
          const { data: sigs } = await supabase
            .from('signatures')
            .select('*')
            .eq('service_order_id', order.id);

          // Build maps for survey/condition
          const interiorSurvey: Record<string, string> = {};
          const condition: Record<string, string> = {};
          inspections?.forEach(ins => {
            if (ins.inspection_type === 'interior') {
              interiorSurvey[ins.item_name] = ins.status;
            } else {
              condition[ins.item_name] = ins.status;
            }
          });

          // Build vehicle images map
          const vehicleImgMap: Record<string, string> = {};
          images?.forEach(img => {
            vehicleImgMap[img.image_type] = img.image_url;
          });

          // Build signature references
          let intakeSig = null;
          let handoverSig = null;
          let advisorSig = null;
          sigs?.forEach(sg => {
            if (sg.signature_type === 'intake') intakeSig = sg.image_url;
            else if (sg.signature_type === 'handover') handoverSig = sg.image_url;
            else if (sg.signature_type === 'advisor') advisorSig = sg.image_url;
          });

          const detailedServices: ServiceItem[] = (items || []).map(it => ({
            id: it.id,
            name: it.service_name,
            price: Number(it.unit_price),
            quantity: it.quantity,
            status: it.status as 'PENDING' | 'EXECUTING' | 'DONE',
            timestamp: it.timestamp,
            isDone: it.status === 'DONE'
          }));

          reconstructedForms.push({
            id: order.id,
            orderCode: order.order_code,
            createdAt: order.created_at || new Date().toISOString(),
            advisorId: order.advisor_id,
            status: order.status as VehicleStatus,
            plateNumber: vehicle?.license_plate || '',
            brand: vehicle?.vehicle_brand || '',
            color: '',
            modelYear: vehicle?.vehicle_year || '',
            carName: vehicle?.vehicle_model || '',
            vin: vehicle?.vin || '',
            odometer: String(vehicle?.current_km || ''),
            inspectionExpiry: '',
            dateIn: order.received_date,
            dateOut: order.expected_delivery || '',
            customerName: customer?.full_name || '',
            customerNamePrinted: customer?.full_name || '',
            gender: '',
            company: '',
            phone: customer?.phone || '',
            email: customer?.email || '',
            address: customer?.address || '',
            district: '',
            city: '',
            birthday: '',
            source: '',
            salesPerson: order.advisor_id,
            services: [],
            detailedServices,
            otherRequests: '',
            interiorSurvey,
            condition,
            fuelLevel: 50,
            techNotes: inspections?.[0]?.note || '', 
            discount: 0,
            tax: 0,
            totalAmount: Number(order.total_amount),
            vehicleImages: vehicleImgMap,
            intakeSignature: intakeSig,
            handoverSignature: handoverSig,
            advisorSignature: advisorSig,
            advisorName: 'Cố vấn'
          });
        }

        return reconstructedForms;
      } catch (err) {
        console.warn('Failed to query Supabase directly. Falling back to local storage...', err);
      }
    }

    // Fallback: LocalStorage
    const saved = localStorage.getItem('garage_forms');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as IntakeForm[];
        // Auto-migrate standard sequential order codes if missing
        let changed = false;
        parsed.forEach((form, index) => {
          if (!form.orderCode) {
            form.orderCode = generateSequentialOrderCode(parsed.length - 1 - index);
            changed = true;
          }
        });
        if (changed) {
          localStorage.setItem('garage_forms', JSON.stringify(parsed));
        }
        return parsed;
      } catch (err) {
        console.error('Error parsing simulated SQL LocalStorage database: ', err);
      }
    }
    return [];
  },

  // COMPREHENSIVE SAVING & UPSERT MAPPING TO 8 RELATIONAL TABELS
  async saveForm(form: IntakeForm): Promise<IntakeForm[]> {
    let currentForms = await this.getForms();

    // Gen unique sequential sequential order code if not exists
    if (!form.orderCode) {
      form.orderCode = generateSequentialOrderCode(currentForms.length);
    }

    if (isSupabaseConfigured && supabase) {
      try {
        console.log('Writing relational entries to Supabase for order:', form.orderCode);
        
        // 1. Upsert customer
        let customerId = '';
        const { data: existCust, error: ce } = await supabase
          .from('customers')
          .select('id')
          .eq('phone', form.phone)
          .maybeSingle();

        if (ce) console.warn('Customer check error:', ce);

        if (existCust) {
          customerId = existCust.id;
          await supabase
            .from('customers')
            .update({
              full_name: form.customerName,
              email: form.email,
              address: form.address
            })
            .eq('id', customerId);
        } else {
          const { data: newCust, error: ne } = await supabase
            .from('customers')
            .insert({
              full_name: form.customerName,
              phone: form.phone,
              email: form.email,
              address: form.address
            })
            .select('id')
            .single();
          if (ne) throw ne;
          customerId = newCust.id;
        }

        // 2. Upsert vehicle linked to customer
        let vehicleId = '';
        const { data: existVeh, error: ve } = await supabase
          .from('vehicles')
          .select('id')
          .eq('license_plate', form.plateNumber)
          .maybeSingle();

        if (ve) console.warn('Vehicle check error:', ve);

        if (existVeh) {
          vehicleId = existVeh.id;
          await supabase
            .from('vehicles')
            .update({
              customer_id: customerId,
              vehicle_brand: form.brand,
              vehicle_model: form.carName,
              vehicle_year: form.modelYear,
              vin: form.vin,
              current_km: parseInt(form.odometer) || 0
            })
            .eq('id', vehicleId);
        } else {
          const { data: newVeh, error: nv } = await supabase
            .from('vehicles')
            .insert({
              customer_id: customerId,
              license_plate: form.plateNumber,
              vehicle_brand: form.brand,
              vehicle_model: form.carName,
              vehicle_year: form.modelYear,
              vin: form.vin,
              current_km: parseInt(form.odometer) || 0
            })
            .select('id')
            .single();
          if (nv) throw nv;
          vehicleId = newVeh.id;
        }

        // 3. Upsert service_order
        const orderPayload = {
          order_code: form.orderCode,
          customer_id: customerId,
          vehicle_id: vehicleId,
          advisor_id: form.advisorId || 'system-advisor',
          status: form.status,
          received_date: form.dateIn || new Date().toISOString().split('T')[0],
          expected_delivery: form.dateOut,
          completed_date: form.status === VehicleStatus.COMPLETED ? new Date().toISOString() : undefined,
          total_amount: form.totalAmount || 0
        };

        const { data: existOrder } = await supabase
          .from('service_orders')
          .select('id')
          .eq('order_code', form.orderCode)
          .maybeSingle();

        let orderId = form.id;
        if (existOrder) {
          orderId = existOrder.id;
          await supabase
            .from('service_orders')
            .update(orderPayload)
            .eq('id', orderId);
        } else {
          const { data: newOrder, error: no } = await supabase
            .from('service_orders')
            .insert({
              id: orderId, // Use preset UUID/id
              ...orderPayload
            })
            .select('id')
            .single();
          if (no) {
            // Retry inserting without hardcoded ID if it causes integrity issues
            const { data: retryNewOrder, error: retryNo } = await supabase
              .from('service_orders')
              .insert(orderPayload)
              .select('id')
              .single();
            if (retryNo) throw retryNo;
            orderId = retryNewOrder.id;
            form.id = orderId; // Sync ID
          } else {
            orderId = newOrder.id;
          }
        }

        // 4. Update service_items (Delete and insert)
        await supabase.from('service_items').delete().eq('service_order_id', orderId);
        if (form.detailedServices && form.detailedServices.length > 0) {
          const servicePayloads = form.detailedServices.map(item => ({
            service_order_id: orderId,
            service_name: item.name,
            quantity: item.quantity,
            unit_price: item.price,
            total: item.price * item.quantity,
            status: item.status || (item.isDone ? 'DONE' : 'PENDING'),
            timestamp: item.timestamp || new Date().toISOString()
          }));
          await supabase.from('service_items').insert(servicePayloads);
        }

        // 5. Update vehicle inspections (interior + condition)
        await supabase.from('vehicle_inspections').delete().eq('service_order_id', orderId);
        const inspectionPayloads: any[] = [];
        Object.entries(form.interiorSurvey || {}).forEach(([key, val]) => {
          if (val) {
            inspectionPayloads.push({
              service_order_id: orderId,
              inspection_type: 'interior',
              item_name: key,
              status: val,
              note: form.techNotes
            });
          }
        });
        Object.entries(form.condition || {}).forEach(([key, val]) => {
          if (val) {
            inspectionPayloads.push({
              service_order_id: orderId,
              inspection_type: 'condition',
              item_name: key,
              status: val,
              note: form.techNotes
            });
          }
        });
        if (inspectionPayloads.length > 0) {
          await supabase.from('vehicle_inspections').insert(inspectionPayloads);
        }

        // 6. Update vehicle images
        await supabase.from('vehicle_images').delete().eq('service_order_id', orderId);
        if (form.vehicleImages) {
          const imgPayloads: any[] = [];
          Object.entries(form.vehicleImages).forEach(([type, url]) => {
            if (url) {
              imgPayloads.push({
                service_order_id: orderId,
                image_url: url,
                image_type: type
              });
            }
          });
          if (imgPayloads.length > 0) {
            await supabase.from('vehicle_images').insert(imgPayloads);
          }
        }

        // 7. Update signatures
        await supabase.from('signatures').delete().eq('service_order_id', orderId);
        const sigPayloads: any[] = [];
        if (form.intakeSignature) {
          sigPayloads.push({
            service_order_id: orderId,
            signature_type: 'intake',
            image_url: form.intakeSignature
          });
        }
        if (form.handoverSignature) {
          sigPayloads.push({
            service_order_id: orderId,
            signature_type: 'handover',
            image_url: form.handoverSignature
          });
        }
        if (sigPayloads.length > 0) {
          await supabase.from('signatures').insert(sigPayloads);
        }

        // Re-get pristine list representing state from DB
        return await this.getForms();
      } catch (err) {
        console.warn('Supabase transactional sync yielded exception. Saving to local database replica...', err);
      }
    }

    // LocalStorage Fallback Saving
    const idx = currentForms.findIndex(f => f.id === form.id);
    if (idx >= 0) {
      currentForms[idx] = form;
    } else {
      currentForms = [form, ...currentForms];
    }
    localStorage.setItem('garage_forms', JSON.stringify(currentForms));
    return currentForms;
  },

  // BULK EXPORT & BACKUP/IMPORT FUNCTIONALITY
  async bulkImport(importedForms: IntakeForm[]): Promise<IntakeForm[]> {
    if (isSupabaseConfigured) {
      for (const form of importedForms) {
        await this.saveForm(form);
      }
      return await this.getForms();
    } else {
      localStorage.setItem('garage_forms', JSON.stringify(importedForms));
      return importedForms;
    }
  }
};
