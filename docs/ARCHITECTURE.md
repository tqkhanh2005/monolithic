# Giải thích Monolithic và Prisma

Một Express app trong `src/app.js`; server trong `src/server.js`. Các router module được mount dưới `/api/auth`, `/api/customers`, `/api/products`, `/api/orders`, `/api/shipments`. Middleware xác minh JWT HS256 và kiểm tra role/owner. `src/config` đọc cấu hình và tạo một Prisma Client dùng pg adapter. Đây là một đơn vị triển khai thống nhất, không dùng gRPC/Kafka như P3.

## ORM và database

`schema.prisma` mô tả Role, User, MemberShip, Product, Order, OrderDetail và Shipment cùng khóa chính/ngoại. OrderDetail dùng khóa ghép oid/pid; giá và unit_price là Decimal(10,2). Migration SQL có kiểm tra giá/số lượng không âm và qty dương. `createdAt` tự lấy thời gian database, tương ứng cột createat trong hình thiết kế.

`prisma generate` tạo Client; `prisma migrate deploy` áp dụng các migration đã có, không reset dữ liệu. Entry point chạy migrate -> seed -> server. Migration bổ sung đổi các tài khoản CUSTOMER cũ sang normal và Standard 0 sang 10; đăng ký luôn chọn chính xác Standard, không lấy membership bất kỳ có điểm thấp nhất.

Seed tạo ADMIN, normal, SHIPMENT_STAFF và Standard/Silver/Gold/Platinum. Người mới là normal/Standard score 10; customer1 seed là Silver score 100 để thử discount. Không nhận quyền cao từ body đăng ký. Khách hàng chỉ xem/sửa hồ sơ và đơn/Shipment của mình; chỉ admin chỉnh membership, sản phẩm; admin/staff cập nhật Shipment.

## Transaction đặt hàng

Client chỉ gửi pid/qty. Server gộp pid trùng, khóa/cập nhật sản phẩm theo thứ tự pid để tránh deadlock khi hai đơn chứa cùng các sản phẩm theo thứ tự khác nhau. `updateMany` có điều kiện quantity >= qty; nếu thiếu tồn kho thì throw và rollback toàn bộ transaction. Server lấy giá từ database, tạo Order cùng Details và Shipment PENDING. Nếu bất kỳ bước nào lỗi, không có đơn dở dang hay kho bị trừ một phần.

Tiền tính theo cent; discount tính từ score, do nguồn chưa nêu bảng cụ thể nên quy ước score <100: 0%, >=100: 5%, >=500: 10%, >=1000: 15%. Phần tiền giảm làm tròn đến cent rồi trừ subtotal. Unit test kiểm tra các biên; integration kiểm tra server không nhận giá/tổng giả từ client.

## Kiểm thử và cấu hình

Database demo là ecommerce; test là ecommerce_test. Script prepare-test-db chỉ cho phép tên ecommerce_test hoặc hậu tố an toàn, tạo database nếu thiếu, migrate và seed. Không reset database chính. Hai test suite tích hợp dùng dữ liệu có tên riêng cho từng lượt chạy.

Dockerfile test stage có dev dependencies; runtime hiện giữ Prisma CLI để chạy migration lúc startup. `.dockerignore` loại node_modules, .git, .env, artifacts và tài liệu tham chiếu. PostgreSQL không publish cổng ra host; demo SQL qua Docker exec.

Prisma được giữ ở 6.19.0 để tương thích source hiện tại; không nâng major tự động. Tham khảo [Prisma v6 migrate deploy](https://www.prisma.io/docs/orm/v6/prisma-client/deployment/deploy-migrations-from-a-local-environment).
