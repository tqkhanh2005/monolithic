# P2 E-commerce Monolithic

Một backend Express duy nhất, Prisma ORM và PostgreSQL, JWT/phân quyền, Docker Compose, health check. Hoàn thiện theo Word P2 và phiếu chấm: **tài khoản mới role normal, score 10**, đơn hàng X2/Y5, Shipment và cập nhật tồn kho trong cùng transaction.

## Chạy local

```powershell
cd C:\dev\monolithic
pwsh -File scripts/setup.ps1
docker compose up -d --build --wait --wait-timeout 300
docker compose ps
curl.exe -i http://localhost:3002/api/health
```

Host dùng **3002** để chạy cùng P1 (3000) và P3 (3003). Container vẫn dùng PORT=3000. `.env` được sinh với mật khẩu PostgreSQL và JWT secret ngẫu nhiên khi chưa có; tệp hiện có được giữ nguyên. Database không publish cổng host, CLI đi qua Docker exec.

Tài khoản seed local: admin/Admin@123, customer1/Customer@123 (Silver score 100), shipper1/Shipper@123. Có thể đổi mật khẩu seed trong `.env` trước lần tạo dữ liệu đầu tiên. Tài khoản tự đăng ký luôn Standard score 10 và role normal; không được tự đặt role/membership.

## Kiểm tra và demo

```powershell
npm ci
npm run lint
npm test
docker compose --profile test run --rm --build tests
npm run demo
```

`npm test` chạy unit giảm giá, không cần DB. Integration tự tạo/migrate/seed database **ecommerce_test riêng**, không reset/xóa database ecommerce của demo. Các script bảo vệ không cho integration chạy nhầm database chính.

`npm run demo` thực hiện đúng yêu cầu: tạo X/Y bằng PostgreSQL CLI -> register normal/10 -> login JWT -> không token 401 -> X2/Y5 -> Order/Details -> Shipment SHIPPING -> xác minh tồn kho 8/15 bằng PostgreSQL CLI.

## Dùng Postman

```powershell
node scripts/create-products.js
```

Lệnh tạo X/Y mới bằng SQL CLI và xuất `artifacts/P2-CLI.postman_environment.json`. Import và chọn environment này cùng `postman/P2.postman_collection.json`; chạy collection theo thứ tự một lần cho mỗi cặp X/Y mới.

Đọc [hướng dẫn đủ 8 tiêu chí](docs/DEMO.md), [giải thích cấu trúc và Prisma](docs/ARCHITECTURE.md) và [kết quả kiểm thử](docs/TESTING.md).

## Dữ liệu và tương thích

Migration bổ sung cập nhật role CUSTOMER cũ sang normal, Standard score 0 sang 10, không xóa users/orders/products. Các bảng và quan hệ giữ nguyên. Token mang role CUSTOMER cũ cần đăng nhập lại. `createdAt` tương ứng field thời gian `createat` trong hình thầy gửi; `discount`, email và phone là các field bổ sung.

Seed idempotent; không ghi đè mật khẩu người dùng đã có. Docker áp dụng migration -> seed -> start. `docker compose down` giữ volumes; không xóa volume nếu muốn giữ dữ liệu.
