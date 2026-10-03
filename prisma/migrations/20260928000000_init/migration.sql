-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('PENDING', 'SHIPPING', 'DELIVERED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Role" (
    "roleid" SERIAL NOT NULL,
    "rolename" VARCHAR(50) NOT NULL,
    CONSTRAINT "Role_pkey" PRIMARY KEY ("roleid")
);

CREATE TABLE "MemberShip" (
    "mid" SERIAL NOT NULL,
    "mname" VARCHAR(50) NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "MemberShip_pkey" PRIMARY KEY ("mid"),
    CONSTRAINT "MemberShip_score_nonneg" CHECK ("score" >= 0)
);

CREATE TABLE "User" (
    "uid" SERIAL NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "fullname" VARCHAR(100),
    "password" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(30),
    "roleid" INTEGER NOT NULL,
    "mid" INTEGER NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("uid")
);

CREATE TABLE "Product" (
    "pid" SERIAL NOT NULL,
    "pname" VARCHAR(100) NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    CONSTRAINT "Product_pkey" PRIMARY KEY ("pid"),
    CONSTRAINT "Product_price_nonneg" CHECK ("price" >= 0),
    CONSTRAINT "Product_quantity_nonneg" CHECK ("quantity" >= 0)
);

CREATE TABLE "Order" (
    "oid" SERIAL NOT NULL,
    "uid" INTEGER NOT NULL,
    "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Order_pkey" PRIMARY KEY ("oid")
);

CREATE TABLE "OrderDetail" (
    "oid" INTEGER NOT NULL,
    "pid" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,
    CONSTRAINT "OrderDetail_pkey" PRIMARY KEY ("oid","pid"),
    CONSTRAINT "OrderDetail_qty_pos" CHECK ("qty" > 0)
);

CREATE TABLE "Shipment" (
    "shipid" SERIAL NOT NULL,
    "oid" INTEGER NOT NULL,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'PENDING',
    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("shipid")
);

-- Indexes
CREATE UNIQUE INDEX "Role_rolename_key" ON "Role"("rolename");
CREATE UNIQUE INDEX "MemberShip_mname_key" ON "MemberShip"("mname");
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_roleid_idx" ON "User"("roleid");
CREATE INDEX "User_mid_idx" ON "User"("mid");
CREATE INDEX "Order_uid_idx" ON "Order"("uid");
CREATE INDEX "OrderDetail_pid_idx" ON "OrderDetail"("pid");
CREATE INDEX "Shipment_oid_idx" ON "Shipment"("oid");

-- Foreign keys
ALTER TABLE "User" ADD CONSTRAINT "User_roleid_fkey" FOREIGN KEY ("roleid") REFERENCES "Role"("roleid") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_mid_fkey" FOREIGN KEY ("mid") REFERENCES "MemberShip"("mid") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_uid_fkey" FOREIGN KEY ("uid") REFERENCES "User"("uid") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderDetail" ADD CONSTRAINT "OrderDetail_oid_fkey" FOREIGN KEY ("oid") REFERENCES "Order"("oid") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderDetail" ADD CONSTRAINT "OrderDetail_pid_fkey" FOREIGN KEY ("pid") REFERENCES "Product"("pid") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_oid_fkey" FOREIGN KEY ("oid") REFERENCES "Order"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;
