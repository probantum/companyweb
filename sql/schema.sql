-- ProBantum MySQL schema.
-- Run once against an empty database: mysql -u <user> -p <database> < sql/schema.sql

CREATE TABLE IF NOT EXISTS blog_posts (
  id VARCHAR(36) PRIMARY KEY,
  slug VARCHAR(255) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  excerpt TEXT,
  author VARCHAR(150),
  date VARCHAR(50),
  read_time VARCHAR(50),
  tags JSON,
  content LONGTEXT,
  image VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS portfolio (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  tags JSON,
  tag VARCHAR(100),
  image VARCHAR(500),
  gallery JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS staff (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(150),
  email VARCHAR(255),
  phone VARCHAR(50),
  linkedin VARCHAR(255),
  image VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS submissions (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  topic VARCHAR(150),
  subject VARCHAR(255),
  message TEXT,
  date VARCHAR(50),
  status VARCHAR(50) DEFAULT 'New',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Single-row site settings (id is always 'default').
CREATE TABLE IF NOT EXISTS settings (
  id VARCHAR(36) PRIMARY KEY,
  notify_emails JSON,
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  contact_location VARCHAR(255),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO settings (id, notify_emails, contact_email, contact_phone, contact_location)
VALUES ('default', JSON_ARRAY(), 'hello@probantum.com', '+254 700 000 000', 'Nairobi, Kenya · Melbourne, AU');
