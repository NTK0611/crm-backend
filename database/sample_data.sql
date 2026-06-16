
-- CRM Backend - Sample Data
-- Run AFTER migration: npx prisma migrate dev
-- Password for all users is: Password123!
-- (bcrypt hash generated with 10 rounds)


-- ─── Clean existing data (order matters due to foreign keys) ───
TRUNCATE TABLE activity_logs    RESTART IDENTITY CASCADE;
TRUNCATE TABLE attachments      RESTART IDENTITY CASCADE;
TRUNCATE TABLE notifications    RESTART IDENTITY CASCADE;
TRUNCATE TABLE webhook_events   RESTART IDENTITY CASCADE;
TRUNCATE TABLE assignments      RESTART IDENTITY CASCADE;
TRUNCATE TABLE messages         RESTART IDENTITY CASCADE;
TRUNCATE TABLE conversation_members RESTART IDENTITY CASCADE;
TRUNCATE TABLE conversations    RESTART IDENTITY CASCADE;
TRUNCATE TABLE customers        RESTART IDENTITY CASCADE;
TRUNCATE TABLE user_roles       RESTART IDENTITY CASCADE;
TRUNCATE TABLE users            RESTART IDENTITY CASCADE;
TRUNCATE TABLE roles            RESTART IDENTITY CASCADE;

-- ─── 1. Roles ─────────────────────────────────────────────
INSERT INTO roles (id, name, description, created_at) VALUES
  ('00000000-0000-0000-0000-000000000001', 'ADMIN',    'Full access to all resources',              NOW()),
  ('00000000-0000-0000-0000-000000000002', 'STAFF',    'Handle conversations and support customers', NOW()),
  ('00000000-0000-0000-0000-000000000003', 'CUSTOMER', 'End user with limited access',              NOW());

-- ─── 2. Users ─────────────────────────────────────────────
-- Password: Password123! (bcrypt hash)
INSERT INTO users (id, email, password_hash, full_name, is_active, created_at, updated_at) VALUES
  ('10000000-0000-0000-0000-000000000001', 'admin@crm.com',   '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Admin User',    true, NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000002', 'staff1@crm.com',  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Nguyen Van An', true, NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000003', 'staff2@crm.com',  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Tran Thi Bich', true, NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000004', 'staff3@crm.com',  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Le Minh Duc',   true, NOW(), NOW());

-- ─── 3. User Roles ────────────────────────────────────────
INSERT INTO user_roles (user_id, role_id, assigned_at) VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', NOW()),  -- admin -> ADMIN
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', NOW()),  -- staff1 -> STAFF
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', NOW()),  -- staff2 -> STAFF
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', NOW());  -- staff3 -> STAFF

-- ─── 4. Customers ─────────────────────────────────────────
INSERT INTO customers (id, name, email, phone, address, status, created_at, updated_at) VALUES
  ('20000000-0000-0000-0000-000000000001', 'Pham Thi Lan',   'lan.pham@gmail.com',   '0901234567', '12 Nguyen Hue, Q1, HCM',          'ACTIVE',   NOW(), NOW()),
  ('20000000-0000-0000-0000-000000000002', 'Hoang Van Kiet', 'kiet.hoang@gmail.com', '0912345678', '45 Le Loi, Q3, HCM',               'ACTIVE',   NOW(), NOW()),
  ('20000000-0000-0000-0000-000000000003', 'Nguyen Thi Mai', 'mai.nguyen@gmail.com', '0923456789', '78 Tran Hung Dao, Hoan Kiem, HN',  'INACTIVE', NOW(), NOW()),
  ('20000000-0000-0000-0000-000000000004', 'Bui Quoc Tuan',  'tuan.bui@gmail.com',   '0934567890', '23 Hoang Dieu, Hai Chau, DN',      'ACTIVE',   NOW(), NOW()),
  ('20000000-0000-0000-0000-000000000005', 'Do Thi Huong',   'huong.do@gmail.com',   '0945678901', '56 Phan Chu Trinh, Hue',           'BLOCKED',  NOW(), NOW());

-- ─── 5. Conversations ─────────────────────────────────────
INSERT INTO conversations (id, customer_id, status, note, created_at, updated_at) VALUES
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'ASSIGNED', 'Customer asking about order #1234',     NOW(), NOW()),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'OPEN',     'Product return request',                NOW(), NOW()),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 'CLOSED',   'Billing issue - resolved',              NOW(), NOW()),
  ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004', 'PENDING',  'Waiting for customer to reply',         NOW(), NOW()),
  ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000005', 'OPEN',     'Technical support for mobile app',      NOW(), NOW());

-- ─── 6. Conversation Members ──────────────────────────────
INSERT INTO conversation_members (id, conversation_id, user_id, joined_at) VALUES
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', NOW()),
  ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', NOW()),
  ('40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', NOW()),
  ('40000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000003', NOW()),
  ('40000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000004', NOW()),
  ('40000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', NOW());

-- ─── 7. Messages ──────────────────────────────────────────
INSERT INTO messages (id, conversation_id, sender_id, sender_type, content, sent_at) VALUES
  -- Conversation 1
  ('50000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'CUSTOMER', 'Xin chào, tôi muốn hỏi về đơn hàng #1234 của tôi?',          NOW()),
  ('50000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'USER',     'Chào bạn! Để tôi kiểm tra đơn hàng của bạn ngay.',            NOW()),
  ('50000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'USER',     'Đơn hàng #1234 đang được giao, dự kiến đến ngày mai.',        NOW()),
  ('50000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'CUSTOMER', 'Cảm ơn bạn nhiều!',                                           NOW()),
  -- Conversation 2
  ('50000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'CUSTOMER', 'Tôi muốn trả lại sản phẩm bị lỗi.',                           NOW()),
  ('50000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'USER',     'Bạn vui lòng cho tôi biết mã sản phẩm và lý do trả hàng?',   NOW()),
  -- Conversation 3
  ('50000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 'CUSTOMER', 'Tôi bị tính phí sai trên hóa đơn tháng này.',                 NOW()),
  ('50000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 'USER',     'Chúng tôi đã kiểm tra và xác nhận đây là lỗi hệ thống. Xin lỗi bạn!', NOW()),
  ('50000000-0000-0000-0000-000000000009', '30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 'USER',     'Chúng tôi sẽ hoàn tiền trong vòng 3-5 ngày làm việc.',        NOW());

-- ─── 8. Assignments ───────────────────────────────────────
INSERT INTO assignments (id, conversation_id, assigned_to, assigned_by, assigned_at) VALUES
  ('60000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', NOW()),
  ('60000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', NOW()),
  ('60000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', NOW());

-- ─── 9. Notifications ─────────────────────────────────────
INSERT INTO notifications (id, user_id, type, content, is_read, reference_id, created_at) VALUES
  ('70000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'NEW_MESSAGE',      'Bạn có tin nhắn mới từ Pham Thi Lan',      false, '30000000-0000-0000-0000-000000000001', NOW()),
  ('70000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'NEW_CONVERSATION', 'Hội thoại mới được giao cho bạn',          false, '30000000-0000-0000-0000-000000000002', NOW()),
  ('70000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 'NEW_MESSAGE',      'Bạn có tin nhắn mới từ Nguyen Thi Mai',    true,  '30000000-0000-0000-0000-000000000003', NOW()),
  ('70000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'ASSIGNMENT',       'Staff1 đã được phân công hội thoại #1',    true,  '30000000-0000-0000-0000-000000000001', NOW());

-- ─── 10. Webhook Events ───────────────────────────────────
INSERT INTO webhook_events (id, event_id, source, payload, status, received_at) VALUES
  ('80000000-0000-0000-0000-000000000001', 'evt_001', 'facebook', '{"type":"message","from":"fb_user_001","text":"Hello"}',           'PROCESSED', NOW()),
  ('80000000-0000-0000-0000-000000000002', 'evt_002', 'zalo',     '{"type":"message","from":"zalo_user_002","text":"Xin chao"}',      'PROCESSED', NOW()),
  ('80000000-0000-0000-0000-000000000003', 'evt_003', 'facebook', '{"type":"message","from":"fb_user_003","text":"Need help"}',       'RECEIVED',  NOW()),
  ('80000000-0000-0000-0000-000000000004', 'evt_004', 'zalo',     '{"type":"delivery","message_id":"msg_001","status":"delivered"}',  'FAILED',    NOW());

-- ─── 11. Attachments ──────────────────────────────────────
INSERT INTO attachments (id, message_id, file_name, file_url, file_type, file_size, created_at) VALUES
  ('90000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000005', 'product_error.jpg',  '/uploads/product_error.jpg',  'image/jpeg',       204800, NOW()),
  ('90000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000007', 'invoice_march.pdf',  '/uploads/invoice_march.pdf',  'application/pdf',  512000, NOW());

-- ─── 12. Activity Logs ────────────────────────────────────
INSERT INTO activity_logs (id, conversation_id, user_id, action, meta, created_at) VALUES
  ('a0000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'ASSIGNED',   '{"assignedTo":"10000000-0000-0000-0000-000000000002"}',  NOW()),
  ('a0000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'ASSIGNED',   '{"assignedTo":"10000000-0000-0000-0000-000000000003"}',  NOW()),
  ('a0000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 'CLOSED',     '{"reason":"Issue resolved"}',                           NOW()),
  ('a0000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'ASSIGNED',   '{"assignedTo":"10000000-0000-0000-0000-000000000003"}',  NOW()),
  ('a0000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'REPLIED',    '{"messageId":"50000000-0000-0000-0000-000000000002"}',   NOW());
