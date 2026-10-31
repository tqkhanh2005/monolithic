# Kết quả kiểm chứng P2 ngày 31 tháng 10 năm 2026

## Đã chạy tại local

- Lint: qua.
- Unit giảm giá và tính tiền: **10/10 qua**.
- Integration thật với Prisma/PostgreSQL: **29/29 qua**, hai suite, database riêng `ecommerce_test`.
- Postman collection chạy bằng Newman: **18 request, 25 assertion, 0 lỗi**; X/Y được tạo trước bằng PostgreSQL CLI.
- Script demo theo phiếu: qua đăng ký normal/score 10, login, không token 401, Order X2/Y5, timestamp hiện hành, details, Shipment SHIPPING và SQL xác nhận kho 8/15.
- Migrate deploy áp dụng thành công cả migration ban đầu và migration rubric_defaults; seed chạy thành công.
- Docker Compose: ecommerce-postgres và ecommerce-monolith healthy, health API HTTP 200/PostgreSQL UP.
- YAML Compose/workflow: parse hợp lệ. `.env` bị ignore và không tracked.

## Các tình huống tích hợp đã kiểm tra

- Bcrypt, đăng ký trùng/thiếu dữ liệu, JWT hết hạn/sai secret/alg none, chặn thiếu token.
- Mặc định role normal và Standard score 10, body đăng ký không thể nâng quyền.
- Admin CRUD sản phẩm, customer bị 403; validation và kiểm tra SQL injection.
- Server tự lấy giá, tính discount; client không được sửa giá/tổng/discount trong đơn.
- Thiếu kho rollback cả đơn và các sản phẩm đã xử lý trước đó.
- Sáu yêu cầu tranh mua tồn kho 3: đúng 3 đơn thành công, không oversell.
- Khách hàng chỉ xem đơn/hồ sơ/Shipment của mình, không tự nâng membership; staff/admin cập nhật Shipment.
- Suite rubric dùng SQL INSERT tạo X/Y, kiểm tra đúng qty 2/5 và quantity còn 8/15 trong database.

## Giới hạn xác nhận

Workflow CI đã được thêm vào repository local, chưa commit/push hoặc chạy trên GitHub trong lượt này. Không chấm điểm thay giảng viên; các thao tác Postman/CLI và giải thích ORM vẫn cần bạn trình bày. Database chính ecommerce được giữ riêng với test database; các lượt demo thêm dữ liệu mới để có bằng chứng, không reset dữ liệu cũ.

## Chạy lại

```powershell
npm run lint
npm test
docker compose --profile test run --rm --build tests
npm run demo
node scripts/create-products.js
```

Lệnh cuối tạo cặp X/Y mới và environment để chạy lại Postman. Không chạy cùng collection nhiều lần trên cặp X/Y đã bị trừ kho. Các kết quả local nằm trong `artifacts/`, được bỏ qua bởi Git.
