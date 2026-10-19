// 真 PKZIP 的 `IZip` / `IZipObject`（宿主层、**引擎无关**）：一份内存里的字节 = 一个包。
//
// 对位 TS 的 `DittoImpl/LazyZip.ts`（中央目录解析、条目读取）+ `DittoImpl/Zip.ts`（`ZipObject` 的
// 读取面）+ `DittoImpl/md5.ts`（SparkMD5）。与 `host/fs_zip.{h,cpp}`（解包目录）并存：
// 目录包走 `FsZip`，`.zip` 本体走 `ZipFile`。
//
// 覆盖：`stored`（method 0）与 `deflate`（method 8，自带 inflate）；ZIP64 **明确拒绝**（与 TS
// `LazyZipReader.open` 同口径：EOCD 里出现 `0xffff`/`0xffffffff` 哨兵就抛）。
#pragma once

#include <cstdint>
#include <map>
#include <memory>
#include <optional>
#include <string>
#include <vector>

#include "lfw/ditto/zip/i_zip.h"

namespace lfw::host {

// RFC 1321 MD5（十六进制小写）。与 `DittoImpl/md5.ts` 的 SparkMD5 逐位一致：字符串按 **UTF-8**
// 字节喂进去。
std::string md5_hex(const uint8_t* data, size_t size);
std::string md5_hex(const std::string& text);

// RFC 1950 zlib 流（2 字节头 + raw deflate + adler32）或裸 deflate（同 `fflate.inflateSync` 的
// 自动判定：`CMF` 低 4 位是 8 且 `(CMF<<8|FLG) % 31 == 0` 就当 zlib）。失败 ⇒ false + error。
bool inflate_bytes(const uint8_t* data, size_t size, std::vector<uint8_t>& out,
                   std::u16string& error);

class ZipFile;

// 包里的一个条目。`read()` 才解压（并缓存），与 TS `ZipObject.bytes()` 同一种懒法。
class ZipFileObject : public IZipObject {
 public:
  ZipFileObject(ZipFile& owner, size_t index, std::u16string name);

  const std::u16string& name() const override { return name_; }
  bool json(Value& out, std::u16string& error) override;
  bool text(Value& out, std::u16string& error) override;
  bool blob_url(Value& out, std::u16string& error) override;
  bool array_buffer(Value& out, std::u16string& error) override;
  bool image_bitmap(Value& out, std::u16string& error) override;

  size_t index() const { return index_; }
  // 解压后的字节（`read` 的口径与 `FsZipObject::read` 相同：失败 ⇒ false + error）。
  bool read(std::string& out, std::u16string& error);

 private:
  ZipFile* owner_;
  size_t index_;
  std::u16string name_;
  std::optional<std::string> cache_;
};

class ZipFile : public IZip {
 public:
  // 解析中央目录。`md5` 不给 ⇒ 按字节算（`read_buf` 的口径）；给了（哪怕空串）⇒ 原样留着
  //（`read_blob` 的口径：TS `md5 ?? ''`）。
  static bool open(std::u16string name, std::shared_ptr<const std::vector<uint8_t>> data,
                   const std::optional<std::u16string>& md5, std::unique_ptr<ZipFile>& out,
                   std::u16string& error);
  // 方便调用点的重载（内部拷进 `shared_ptr`）。
  static bool open(std::u16string name, std::vector<uint8_t> data,
                   const std::optional<std::u16string>& md5, std::unique_ptr<ZipFile>& out,
                   std::u16string& error);

  const std::u16string& name() const override { return name_; }
  IZipObject* file(const std::u16string& path) override;
  std::vector<IZipObject*> file_regex(const std::u16string& pattern) override;
  std::optional<std::u16string> md5() const override { return md5_; }

  // ---- 诊断/比对面（`--zip-diff` 用；TS 侧的 `entries` 是只读数组）----
  size_t entry_count() const { return entries_.size(); }
  const std::u16string& entry_name(size_t index) const { return entries_[index].name; }
  uint16_t entry_method(size_t index) const { return entries_[index].method; }
  uint32_t entry_size(size_t index) const { return entries_[index].usize; }
  // 条目字节（`ZipFileObject::read` 的同一条路）。
  bool read_entry(size_t index, std::string& out, std::u16string& error);

 private:
  struct Entry {
    std::u16string name;
    uint16_t flags = 0;
    uint16_t method = 0;
    uint32_t crc = 0;
    uint32_t csize = 0;
    uint32_t usize = 0;
    uint32_t lho = 0;
  };

  ZipFile(std::u16string name, std::shared_ptr<const std::vector<uint8_t>> data,
          std::optional<std::u16string> md5);

  std::u16string name_;
  std::shared_ptr<const std::vector<uint8_t>> data_;
  std::optional<std::u16string> md5_;
  std::vector<Entry> entries_;
  // `files` 那张表的查表序：名字**首次出现**的位置（TS 对象键的插入序）+ 最后一次出现的条目。
  std::vector<std::pair<std::u16string, size_t>> order_;
  std::map<std::u16string, size_t> by_name_;
  std::vector<std::unique_ptr<ZipFileObject>> objects_;
};

}  // namespace lfw::host
