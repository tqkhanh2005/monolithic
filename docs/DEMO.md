# Demo P2 theo đủ 8 tiêu chí

Mở PowerShell 7 tại `C:\dev\monolithic`.

## 1 Giải thích Monolithic

```powershell
Get-ChildItem src
Get-ChildItem src/modules
Get-ChildItem prisma
```

Một project, một tiến trình Express, các module auth/customer/product/order/shipment chạy trong cùng backend; mọi module dùng cùng Prisma Client và PostgreSQL. Các thư mục không phải các microservice riêng. Xem ARCHITECTURE.md để giải thích trước giảng viên.

## 2 Gitignore và env

```powershell
git check-ignore -v .env
git ls-files .env
git ls-files .env.example .gitignore
```

Mong đợi `.env` bị ignore, không tracked. Mở GitHub để kiểm tra thực tế `.env.example`/`.gitignore` có và `.env` không có. Không trình chiếu nội dung secret.

## 3 Prisma ORM

Mở `prisma/schema.prisma`, hai thư mục migrations, `prisma/seed.js`, `src/config/prisma.js` và `src/modules/orders.js`.

Schema khai báo model/quan hệ; migrate deploy áp dụng SQL versioned; generate tạo Prisma Client; seed tạo dữ liệu ban đầu; Prisma Client/pg adapter truy vấn PostgreSQL. Chỉ ra `$transaction` tạo Order/OrderDetail/Shipment và trừ quantity nguyên tử.

## 4 Compose và health

```powershell
pwsh -File scripts/setup.ps1
docker compose config --quiet
docker compose up -d --build --wait --wait-timeout 300
docker compose ps
docker inspect --format '{{.Name}} {{.State.Status}} {{.State.Health.Status}}' ecommerce-postgres ecommerce-monolith
curl.exe -i http://localhost:3002/api/health
```

Mong đợi cả hai healthy; HTTP 200 và postgresql UP. Health chạy SELECT 1, không chỉ kiểm tra server còn sống.

## 5 PostgreSQL CLI và tạo X Y

```powershell
# Tự dùng đúng POSTGRES_USER/POSTGRES_DB trong .env, không in mật khẩu
node scripts/create-products.js
```

Script thực thi INSERT qua `docker compose exec postgres psql`, không qua Product API. In pidX/pidY và tạo environment Postman để nhập đúng các ID đó. Dưới đây là các lệnh SQL tương đương, trong psql:

```sql
\dt
\d "User"
\d "Product"
\d "Order"
\d "OrderDetail"
\d "Shipment"
INSERT INTO "Product" (pname,price,quantity) VALUES ('Product X',100,10) RETURNING pid;
INSERT INTO "Product" (pname,price,quantity) VALUES ('Product Y',200,20) RETURNING pid;
```

Để mở psql, dùng `docker exec -it ecommerce-postgres psql -U ecommerce -d ecommerce` nếu giữ tên user/database mặc định. Có Role, MemberShip, User, Product, Order, OrderDetail, Shipment; Prisma có bảng `_prisma_migrations` bổ sung. Không tự chỉ định pid để tránh lệch SERIAL sequence.

## 6 Register normal score 10 và login JWT

Import collection và environment CLI vừa tạo; chọn environment đó. Chạy Health -> staff/admin login -> Register -> Login and save JWT -> Verify normal and score 10. Response hồ sơ có role normal, membership.score 10. Không dùng seed customer1 để chứng minh mặc định mới vì seed customer1 là Silver.

## 7 Order và Shipment

Chạy tiếp collection: Get X/Y -> Order without token (401) -> Order X2 Y5 with JWT (201) -> Order and details -> Shipment PENDING -> customer đổi shipment bị 403 -> staff đổi SHIPPING -> xem lại SHIPPING. Order có thời gian hiện hành, server lấy giá/tính tổng, tạo Shipment ngay trong transaction của monolith.

Mong đợi total_amount=1200, hai details qty 2 và 5. Tồn kho X=8, Y=15. Muốn demo lại từ đầu phải tạo cặp X/Y mới bằng CLI và import environment mới.

## 8 Kiểm tra database sau đặt hàng

Trong psql:

```sql
SELECT u.uid,u.username,r.rolename,m.mname,m.score FROM "User" u JOIN "Role" r USING(roleid) JOIN "MemberShip" m USING(mid) ORDER BY uid;
SELECT * FROM "Order" ORDER BY oid;
SELECT * FROM "OrderDetail" ORDER BY oid,pid;
SELECT * FROM "Product" ORDER BY pid;
SELECT * FROM "Shipment" ORDER BY shipid;
```

Đối chiếu đúng oid và pid của lượt demo: Order một dòng, hai details, kho giảm 2/5, Shipment SHIPPING. Không chỉ nhìn các dữ liệu seed có sẵn.

## Chạy kiểm tra tự động

```powershell
npm run lint
npm test
docker compose --profile test run --rm --build tests
npm run demo
```

Demo tự động cũng tạo X/Y và kiểm tra dữ liệu bằng psql CLI; summary trong artifacts/demo.json. Test tích hợp riêng xác nhận normal/10, X2/Y5, rollback khi thiếu kho, chống oversell và owner/admin/staff.
