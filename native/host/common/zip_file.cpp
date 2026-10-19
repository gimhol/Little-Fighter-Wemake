#include "host/common/zip_file.h"

#include <algorithm>
#include <array>
#include <cstring>
#include <string>

#include "lfw/core/json.h"
#include "lfw/core/json5.h"
#include "lfw/utils/utf8.h"

namespace lfw::host {

namespace {

// ---------------------------------------------------------------- MD5（RFC 1321）

struct Md5State {
  uint32_t a = 0x67452301u;
  uint32_t b = 0xefcdab89u;
  uint32_t c = 0x98badcfeu;
  uint32_t d = 0x10325476u;
  uint64_t len = 0;
  uint8_t buf[64] = {};
  size_t n = 0;
};

uint32_t rotl(uint32_t v, int k) { return (v << k) | (v >> (32 - k)); }

void md5_block(Md5State& s, const uint8_t* p) {
  static const std::array<uint32_t, 64> K = {
      0xd76aa478u, 0xe8c7b756u, 0x242070dbu, 0xc1bdceeeu, 0xf57c0fafu, 0x4787c62au, 0xa8304613u,
      0xfd469501u, 0x698098d8u, 0x8b44f7afu, 0xffff5bb1u, 0x895cd7beu, 0x6b901122u, 0xfd987193u,
      0xa679438eu, 0x49b40821u, 0xf61e2562u, 0xc040b340u, 0x265e5a51u, 0xe9b6c7aau, 0xd62f105du,
      0x02441453u, 0xd8a1e681u, 0xe7d3fbc8u, 0x21e1cde6u, 0xc33707d6u, 0xf4d50d87u, 0x455a14edu,
      0xa9e3e905u, 0xfcefa3f8u, 0x676f02d9u, 0x8d2a4c8au, 0xfffa3942u, 0x8771f681u, 0x6d9d6122u,
      0xfde5380cu, 0xa4beea44u, 0x4bdecfa9u, 0xf6bb4b60u, 0xbebfbc70u, 0x289b7ec6u, 0xeaa127fau,
      0xd4ef3085u, 0x04881d05u, 0xd9d4d039u, 0xe6db99e5u, 0x1fa27cf8u, 0xc4ac5665u, 0xf4292244u,
      0x432aff97u, 0xab9423a7u, 0xfc93a039u, 0x655b59c3u, 0x8f0ccc92u, 0xffeff47du, 0x85845dd1u,
      0x6fa87e4fu, 0xfe2ce6e0u, 0xa3014314u, 0x4e0811a1u, 0xf7537e82u, 0xbd3af235u, 0x2ad7d2bbu,
      0xeb86d391u};
  static const std::array<int, 64> S = {7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
                                        5, 9,  14, 20, 5, 9,  14, 20, 5, 9,  14, 20, 5, 9,  14, 20,
                                        4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
                                        6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21};
  uint32_t m[16];
  for (int i = 0; i < 16; ++i) {
    m[i] = static_cast<uint32_t>(p[i * 4]) | (static_cast<uint32_t>(p[i * 4 + 1]) << 8) |
           (static_cast<uint32_t>(p[i * 4 + 2]) << 16) | (static_cast<uint32_t>(p[i * 4 + 3]) << 24);
  }
  uint32_t a = s.a;
  uint32_t b = s.b;
  uint32_t c = s.c;
  uint32_t d = s.d;
  for (int i = 0; i < 64; ++i) {
    uint32_t f = 0;
    int g = 0;
    if (i < 16) {
      f = (b & c) | (~b & d);
      g = i;
    } else if (i < 32) {
      f = (d & b) | (~d & c);
      g = (5 * i + 1) % 16;
    } else if (i < 48) {
      f = b ^ c ^ d;
      g = (3 * i + 5) % 16;
    } else {
      f = c ^ (b | ~d);
      g = (7 * i) % 16;
    }
    const uint32_t tmp = d;
    d = c;
    c = b;
    b = b + rotl(a + f + K[static_cast<size_t>(i)] + m[g], S[static_cast<size_t>(i)]);
    a = tmp;
  }
  s.a += a;
  s.b += b;
  s.c += c;
  s.d += d;
}

void md5_update(Md5State& s, const uint8_t* p, size_t n) {
  s.len += n;
  while (n > 0) {
    const size_t take = std::min(n, 64 - s.n);
    std::memcpy(s.buf + s.n, p, take);
    s.n += take;
    p += take;
    n -= take;
    if (s.n == 64) {
      md5_block(s, s.buf);
      s.n = 0;
    }
  }
}

std::string md5_final(Md5State& s) {
  const uint64_t bits = s.len * 8u;
  const uint8_t pad = 0x80;
  md5_update(s, &pad, 1);
  const uint8_t zero = 0;
  while (s.n != 56) md5_update(s, &zero, 1);
  uint8_t tail[8];
  for (int i = 0; i < 8; ++i) tail[i] = static_cast<uint8_t>((bits >> (8 * i)) & 0xffu);
  md5_update(s, tail, 8);
  const uint32_t words[4] = {s.a, s.b, s.c, s.d};
  static const char* const kHex = "0123456789abcdef";
  std::string out;
  out.reserve(32);
  for (const uint32_t w : words) {
    for (int i = 0; i < 4; ++i) {
      const uint8_t byte = static_cast<uint8_t>((w >> (8 * i)) & 0xffu);
      out.push_back(kHex[byte >> 4]);
      out.push_back(kHex[byte & 0xfu]);
    }
  }
  return out;
}

// ---------------------------------------------------------------- inflate（RFC 1951）

// 位流：LSB 优先（deflate 的口径）。
class BitStream {
 public:
  BitStream(const uint8_t* data, size_t size) : data_(data), size_(size) {}

  bool get(int count, uint32_t& out) {
    if (!fill(count)) return false;
    out = static_cast<uint32_t>(buf_ & ((uint64_t{1} << count) - 1u));
    buf_ >>= count;
    cnt_ -= count;
    return true;
  }
  // 丢到字节边界（`stored` 块前那一步）。
  void align() {
    const int drop = cnt_ & 7;
    buf_ >>= drop;
    cnt_ -= drop;
  }
  void skip_bytes(size_t n) {  // 只在 `align()` 之后用
    pos_ = pos_ + n > size_ ? size_ : pos_ + n;
  }
  bool need_bytes(const uint8_t*& p, size_t n) {
    if (pos_ + n > size_) return false;
    p = data_ + pos_;
    pos_ += n;
    return true;
  }

 private:
  bool fill(int count) {
    while (cnt_ < count) {
      if (pos_ >= size_) return false;
      buf_ |= static_cast<uint64_t>(data_[pos_++]) << cnt_;
      cnt_ += 8;
    }
    return true;
  }

  const uint8_t* data_;
  size_t size_;
  size_t pos_ = 0;
  uint64_t buf_ = 0;
  int cnt_ = 0;
};

struct Huffman {
  // counts[l] = 长度为 l 的码有几个；symbols 按 (长度, 符号序) 排好 —— puff 那一套。
  std::vector<uint16_t> counts;
  std::vector<uint16_t> symbols;
};

bool build_huffman(const std::vector<int>& lengths, Huffman& h, std::u16string& error) {
  h.counts.assign(16, 0);
  for (const int len : lengths) {
    if (len < 0 || len > 15) {
      error = u"[inflate] bad code length";
      return false;
    }
    if (len > 0) ++h.counts[static_cast<size_t>(len)];
  }
  if (h.counts[0] == lengths.size()) return true;  // 全是 0：没有码（合法，只在 distance 表出现）
  int left = 1;
  for (int len = 1; len <= 15; ++len) {
    left <<= 1;
    left -= h.counts[static_cast<size_t>(len)];
    if (left < 0) {
      error = u"[inflate] over-subscribed huffman code";
      return false;
    }
  }
  std::vector<uint16_t> offs(16, 0);
  for (int len = 1; len < 15; ++len) {
    offs[static_cast<size_t>(len) + 1] =
        static_cast<uint16_t>(offs[static_cast<size_t>(len)] + h.counts[static_cast<size_t>(len)]);
  }
  h.symbols.assign(lengths.size(), 0);
  for (size_t sym = 0; sym < lengths.size(); ++sym) {
    const int len = lengths[sym];
    if (len == 0) continue;
    h.symbols[offs[static_cast<size_t>(len)]++] = static_cast<uint16_t>(sym);
  }
  return true;
}

// 逐位取一个符号；失败 ⇒ -1。
int decode_symbol(BitStream& bs, const Huffman& h) {
  int code = 0;
  int first = 0;
  int index = 0;
  for (int len = 1; len <= 15; ++len) {
    uint32_t bit = 0;
    if (!bs.get(1, bit)) return -1;
    code |= static_cast<int>(bit);
    const int count = h.counts[static_cast<size_t>(len)];
    if (code - count < first) return h.symbols[static_cast<size_t>(index + (code - first))];
    index += count;
    first += count;
    first <<= 1;
    code <<= 1;
  }
  return -1;
}

const std::array<int, 29>& len_base() {
  static const std::array<int, 29> t = {3,  4,  5,  6,  7,  8,  9,  10, 11,  13,  15,  17,  19, 23, 27,
                                        31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258};
  return t;
}
const std::array<int, 29>& len_extra() {
  static const std::array<int, 29> t = {0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2,
                                        2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0};
  return t;
}
const std::array<int, 30>& dist_base() {
  static const std::array<int, 30> t = {1,    2,    3,    4,    5,    7,     9,     13,   17,   25,
                                        33,   49,   65,   97,   129,  193,   257,   385,  513,  769,
                                        1025, 1537, 2049, 3073, 4097, 6145,  8193,  12289, 16385, 24577};
  return t;
}
const std::array<int, 30>& dist_extra() {
  static const std::array<int, 30> t = {0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6,
                                        6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13};
  return t;
}

bool fixed_tables(Huffman& lit, Huffman& dist, std::u16string& error) {
  std::vector<int> lit_len(288, 0);
  for (int i = 0; i < 144; ++i) lit_len[static_cast<size_t>(i)] = 8;
  for (int i = 144; i < 256; ++i) lit_len[static_cast<size_t>(i)] = 9;
  for (int i = 256; i < 280; ++i) lit_len[static_cast<size_t>(i)] = 7;
  for (int i = 280; i < 288; ++i) lit_len[static_cast<size_t>(i)] = 8;
  if (!build_huffman(lit_len, lit, error)) return false;
  std::vector<int> dist_len(30, 5);
  return build_huffman(dist_len, dist, error);
}

bool inflate_codes(BitStream& bs, const Huffman& lit, const Huffman& dist,
                   std::vector<uint8_t>& out, std::u16string& error) {
  while (true) {
    const int sym = decode_symbol(bs, lit);
    if (sym < 0) {
      error = u"[inflate] bad literal/length symbol";
      return false;
    }
    if (sym < 256) {
      out.push_back(static_cast<uint8_t>(sym));
      continue;
    }
    if (sym == 256) return true;  // end of block
    const int li = sym - 257;
    if (li >= static_cast<int>(len_base().size())) {
      error = u"[inflate] bad length code";
      return false;
    }
    uint32_t extra = 0;
    if (!bs.get(len_extra()[static_cast<size_t>(li)], extra)) {
      error = u"[inflate] truncated length extra bits";
      return false;
    }
    const size_t length = static_cast<size_t>(len_base()[static_cast<size_t>(li)]) + extra;

    const int dsym = decode_symbol(bs, dist);
    if (dsym < 0 || dsym >= static_cast<int>(dist_base().size())) {
      error = u"[inflate] bad distance symbol";
      return false;
    }
    uint32_t dextra = 0;
    if (!bs.get(dist_extra()[static_cast<size_t>(dsym)], dextra)) {
      error = u"[inflate] truncated distance extra bits";
      return false;
    }
    const size_t distance = static_cast<size_t>(dist_base()[static_cast<size_t>(dsym)]) + dextra;
    if (distance > out.size()) {
      error = u"[inflate] distance too far back";
      return false;
    }
    const size_t start = out.size() - distance;
    for (size_t i = 0; i < length; ++i) out.push_back(out[start + i]);  // 允许重叠（逐字节）
  }
}

bool inflate_stored(BitStream& bs, std::vector<uint8_t>& out, std::u16string& error) {
  bs.align();
  const uint8_t* p = nullptr;
  if (!bs.need_bytes(p, 4)) {
    error = u"[inflate] truncated stored header";
    return false;
  }
  const uint32_t len = static_cast<uint32_t>(p[0]) | (static_cast<uint32_t>(p[1]) << 8);
  const uint32_t nlen = static_cast<uint32_t>(p[2]) | (static_cast<uint32_t>(p[3]) << 8);
  if ((len ^ 0xffffu) != nlen) {
    error = u"[inflate] stored block length check failed";
    return false;
  }
  const uint8_t* body = nullptr;
  if (!bs.need_bytes(body, len)) {
    error = u"[inflate] truncated stored block";
    return false;
  }
  out.insert(out.end(), body, body + len);
  return true;
}

bool inflate_dynamic(BitStream& bs, Huffman& lit, Huffman& dist, std::u16string& error) {
  uint32_t hlit = 0;
  uint32_t hdist = 0;
  uint32_t hclen = 0;
  if (!bs.get(5, hlit) || !bs.get(5, hdist) || !bs.get(4, hclen)) {
    error = u"[inflate] truncated dynamic header";
    return false;
  }
  const size_t nlit = hlit + 257;
  const size_t ndist = hdist + 1;
  const size_t nclen = hclen + 4;
  if (nlit > 286 || ndist > 30) {
    error = u"[inflate] bad dynamic counts";
    return false;
  }
  static const std::array<int, 19> kOrder = {16, 17, 18, 0, 8,  7, 9,  6, 10, 5,
                                             11, 4,  12, 3, 13, 2, 14, 1, 15};
  std::vector<int> clen(19, 0);
  for (size_t i = 0; i < nclen; ++i) {
    uint32_t v = 0;
    if (!bs.get(3, v)) {
      error = u"[inflate] truncated code-length table";
      return false;
    }
    clen[static_cast<size_t>(kOrder[i])] = static_cast<int>(v);
  }
  Huffman cl;
  if (!build_huffman(clen, cl, error)) return false;

  std::vector<int> lengths(nlit + ndist, 0);
  size_t i = 0;
  while (i < lengths.size()) {
    const int sym = decode_symbol(bs, cl);
    if (sym < 0) {
      error = u"[inflate] bad code-length symbol";
      return false;
    }
    if (sym < 16) {
      lengths[i++] = sym;
      continue;
    }
    size_t repeat = 0;
    int value = 0;
    if (sym == 16) {
      if (i == 0) {
        error = u"[inflate] repeat with no previous length";
        return false;
      }
      uint32_t extra = 0;
      if (!bs.get(2, extra)) {
        error = u"[inflate] truncated repeat";
        return false;
      }
      repeat = 3 + extra;
      value = lengths[i - 1];
    } else if (sym == 17) {
      uint32_t extra = 0;
      if (!bs.get(3, extra)) {
        error = u"[inflate] truncated repeat";
        return false;
      }
      repeat = 3 + extra;
    } else {
      uint32_t extra = 0;
      if (!bs.get(7, extra)) {
        error = u"[inflate] truncated repeat";
        return false;
      }
      repeat = 11 + extra;
    }
    if (i + repeat > lengths.size()) {
      error = u"[inflate] repeat overflows the table";
      return false;
    }
    for (size_t k = 0; k < repeat; ++k) lengths[i++] = value;
  }
  const std::vector<int> lit_len(lengths.begin(), lengths.begin() + static_cast<ptrdiff_t>(nlit));
  const std::vector<int> dist_len(lengths.begin() + static_cast<ptrdiff_t>(nlit), lengths.end());
  if (lit_len[256] == 0) {
    error = u"[inflate] missing end-of-block code";
    return false;
  }
  if (!build_huffman(lit_len, lit, error)) return false;
  return build_huffman(dist_len, dist, error);
}

uint32_t adler32(const uint8_t* data, size_t size) {
  uint32_t a = 1;
  uint32_t b = 0;
  for (size_t i = 0; i < size; ++i) {
    a = (a + data[i]) % 65521u;
    b = (b + a) % 65521u;
  }
  return (b << 16) | a;
}

// `fflate.inflateSync` 的自动判定：zlib 头（CM=8 且 16 位和能被 31 整除）就跳 2 字节。
bool looks_like_zlib(const uint8_t* data, size_t size) {
  if (size < 2) return false;
  if ((data[0] & 0x0fu) != 8) return false;
  return ((static_cast<uint32_t>(data[0]) << 8) | data[1]) % 31u == 0;
}

// ---------------------------------------------------------------- 小工具

std::u16string as_u16(const std::string& s) {
  return decode_utf8(std::vector<uint8_t>(s.begin(), s.end()));
}

std::u16string as_u16(const char* s) {
  const std::string text(s);
  return as_u16(text);
}

std::u16string as_u16(const uint8_t* p, size_t n) {
  return decode_utf8(std::vector<uint8_t>(p, p + n));
}

uint16_t rd16(const uint8_t* p) {
  return static_cast<uint16_t>(p[0]) | static_cast<uint16_t>(p[1] << 8);
}
uint32_t rd32(const uint8_t* p) {
  return static_cast<uint32_t>(p[0]) | (static_cast<uint32_t>(p[1]) << 8) |
         (static_cast<uint32_t>(p[2]) << 16) | (static_cast<uint32_t>(p[3]) << 24);
}

constexpr uint32_t kEocdSig = 0x06054b50u;
constexpr uint32_t kCdSig = 0x02014b50u;
constexpr uint32_t kLfhSig = 0x04034b50u;
constexpr size_t kMaxEocdSearch = 22 + 0xffff;

}  // namespace

std::string md5_hex(const uint8_t* data, size_t size) {
  Md5State s;
  md5_update(s, data, size);
  return md5_final(s);
}

std::string md5_hex(const std::string& text) {
  return md5_hex(reinterpret_cast<const uint8_t*>(text.data()), text.size());
}

bool inflate_bytes(const uint8_t* data, size_t size, std::vector<uint8_t>& out,
                   std::u16string& error) {
  const bool zlib = looks_like_zlib(data, size);
  const size_t start = zlib ? 2 : 0;
  if (zlib && size >= 2) {
    if ((data[1] & 0x20u) != 0) {  // FDICT：预置字典，deflate 里没有这条（TS 也不支持）
      error = u"[inflate] preset dictionary is not supported";
      return false;
    }
  }
  if (size < start) {
    error = u"[inflate] truncated zlib header";
    return false;
  }
  const size_t end = zlib && size >= start + 4 ? size - 4 : size;  // 尾巴 4 字节是 adler32
  BitStream bs(data + start, end - start);
  while (true) {
    uint32_t last = 0;
    uint32_t type = 0;
    if (!bs.get(1, last) || !bs.get(2, type)) {
      error = u"[inflate] truncated block header";
      return false;
    }
    if (type == 0) {
      if (!inflate_stored(bs, out, error)) return false;
    } else if (type == 1 || type == 2) {
      Huffman lit;
      Huffman dist;
      if (type == 1) {
        if (!fixed_tables(lit, dist, error)) return false;
      } else if (!inflate_dynamic(bs, lit, dist, error)) {
        return false;
      }
      if (!inflate_codes(bs, lit, dist, out, error)) return false;
    } else {
      error = u"[inflate] invalid block type";
      return false;
    }
    if (last == 1) break;
  }
  if (zlib && size >= start + 4) {
    const uint32_t want = rd32(data + size - 4);
    const uint32_t got = adler32(out.data(), out.size());
    if (want != got) {
      error = u"[inflate] adler32 mismatch";
      return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------- ZipFile

ZipFileObject::ZipFileObject(ZipFile& owner, size_t index, std::u16string name)
    : owner_(&owner), index_(index), name_(std::move(name)) {}

bool ZipFileObject::read(std::string& out, std::u16string& error) {
  if (cache_.has_value()) {
    out = *cache_;
    return true;
  }
  if (!owner_->read_entry(index_, out, error)) return false;
  cache_ = out;
  return true;
}

bool ZipFileObject::json(Value& out, std::u16string& error) {
  std::string raw;
  if (!read(raw, error)) return false;
  const std::u16string text = as_u16(raw);
  // 与 `FsZipObject::json` 同口径：JSON5 是 JSON 的超集，失败再退回严格 JSON。
  const Json5Result r = json5_parse(text);
  if (r.ok) {
    out = r.value;
    return true;
  }
  const std::optional<Value> strict = json_parse(text);
  if (strict.has_value()) {
    out = *strict;
    return true;
  }
  error = u"[ZipFileObject::json] parse failed: " + name_ + u" (" + r.error + u")";
  return false;
}

bool ZipFileObject::text(Value& out, std::u16string& error) {
  std::string raw;
  if (!read(raw, error)) return false;
  out = Value(as_u16(raw));
  return true;
}

bool ZipFileObject::blob_url(Value& out, std::u16string& error) {
  // 与 `FsZipObject::blob_url` 同口径：宿主没有 blob 层 ⇒ 给条目名（消费者只把它当标识）。
  (void)error;
  out = Value(name_);
  return true;
}

bool ZipFileObject::array_buffer(Value& out, std::u16string& error) {
  std::string raw;
  if (!read(raw, error)) return false;
  auto arr = std::make_shared<Array>();
  for (const unsigned char c : raw) arr->push_back(Value(static_cast<double>(c)));
  out = Value(std::move(arr));
  return true;
}

bool ZipFileObject::image_bitmap(Value& out, std::u16string& error) {
  (void)out;
  // 宿主没有位图解码（渲染层在平台侧）⇒ 与 `FsZipObject::image_bitmap` 同一句拒绝。
  error = u"[ZipFileObject::image_bitmap] not supported by the headless host: " + name_;
  return false;
}

ZipFile::ZipFile(std::u16string name, std::shared_ptr<const std::vector<uint8_t>> data,
                 std::optional<std::u16string> md5)
    : name_(std::move(name)), data_(std::move(data)), md5_(std::move(md5)) {}

bool ZipFile::open(std::u16string name, std::vector<uint8_t> data,
                   const std::optional<std::u16string>& md5, std::unique_ptr<ZipFile>& out,
                   std::u16string& error) {
  return open(std::move(name),
              std::make_shared<const std::vector<uint8_t>>(std::move(data)), md5, out, error);}

bool ZipFile::open(std::u16string name, std::shared_ptr<const std::vector<uint8_t>> data,
                   const std::optional<std::u16string>& md5, std::unique_ptr<ZipFile>& out,
                   std::u16string& error) {
  const auto fail = [&error, &name](const char* what) {
    error = u"[ZipFile] " + as_u16(what) + u": " + name;
    return false;
  };
  if (data == nullptr || data->size() < 22) return fail("too small to be a zip");
  const uint8_t* const base = data->data();
  const size_t size = data->size();

  // EOCD：从尾巴往前扫，并且校验注释长度（TS 的第二道条件）。
  const size_t tail_len = std::min(size, kMaxEocdSearch);
  const size_t tail_off = size - tail_len;
  long long eocd = -1;
  for (size_t i = tail_len - 22 + 1; i-- > 0;) {
    if (rd32(base + tail_off + i) != kEocdSig) continue;
    if (rd16(base + tail_off + i + 20) != tail_len - i - 22) continue;
    eocd = static_cast<long long>(tail_off + i);
    break;
  }
  if (eocd < 0) return fail("end of central directory not found");
  const uint8_t* const e = base + static_cast<size_t>(eocd);
  const uint32_t count = rd16(e + 10);
  const uint32_t cd_size = rd32(e + 12);
  const uint32_t cd_off = rd32(e + 16);
  if (count == 0xffffu || cd_size == 0xffffffffu || cd_off == 0xffffffffu) {
    return fail("zip64 is not supported");
  }
  if (static_cast<size_t>(cd_off) + cd_size > size) return fail("central directory out of range");

  auto zip = std::unique_ptr<ZipFile>(new ZipFile(std::move(name), std::move(data), md5));
  for (size_t p = static_cast<size_t>(cd_off); p + 46 <= static_cast<size_t>(cd_off) + cd_size;) {
    if (rd32(base + p) != kCdSig) return fail("bad central directory record");
    Entry entry;
    entry.flags = rd16(base + p + 8);
    entry.method = rd16(base + p + 10);
    entry.crc = rd32(base + p + 16);
    entry.csize = rd32(base + p + 20);
    entry.usize = rd32(base + p + 24);
    const uint32_t name_len = rd16(base + p + 28);
    const uint32_t extra_len = rd16(base + p + 30);
    const uint32_t comment_len = rd16(base + p + 32);
    entry.lho = rd32(base + p + 42);
    if (p + 46 + name_len > size) return fail("central directory name out of range");
    entry.name = as_u16(base + p + 46, name_len);
    zip->entries_.push_back(entry);
    // `files` 的键序：首次出现决定位置（TS 对象键的插入序），值取最后一次出现的条目。
    const size_t index = zip->entries_.size() - 1;
    if (zip->by_name_.find(entry.name) == zip->by_name_.end()) {
      zip->order_.emplace_back(entry.name, index);
    }
    zip->by_name_[entry.name] = index;
    p += 46u + name_len + extra_len + comment_len;
  }
  if (zip->entries_.size() != count) return fail("entry count mismatch");
  out = std::move(zip);
  return true;
}

IZipObject* ZipFile::file(const std::u16string& path) {
  const auto found = by_name_.find(path);
  if (found == by_name_.end()) return nullptr;
  const size_t index = found->second;
  for (const std::unique_ptr<ZipFileObject>& obj : objects_) {
    if (obj->index() == index) return obj.get();
  }
  objects_.push_back(
      std::make_unique<ZipFileObject>(*this, index, entries_[index].name));
  return objects_.back().get();
}

std::vector<IZipObject*> ZipFile::file_regex(const std::u16string& pattern) {
  std::vector<IZipObject*> out;
  for (const std::pair<std::u16string, size_t>& kv : order_) {
    if (!zip_name_matches(kv.first, pattern)) continue;
    out.push_back(file(kv.first));
  }
  return out;
}

bool ZipFile::read_entry(size_t index, std::string& out, std::u16string& error) {
  if (index >= entries_.size()) {
    error = u"[ZipFile] entry index out of range";
    return false;
  }
  const Entry& entry = entries_[index];
  const uint8_t* const base = data_->data();
  const size_t size = data_->size();
  if (static_cast<size_t>(entry.lho) + 30 > size) {
    error = u"[ZipFile] local file header out of range: " + entry.name;
    return false;
  }
  const uint8_t* const lho = base + entry.lho;
  if (rd32(lho) != kLfhSig) {
    error = u"[ZipFile] bad local file header: " + entry.name;
    return false;
  }
  const size_t data_off =
      static_cast<size_t>(entry.lho) + 30u + rd16(lho + 26) + rd16(lho + 28);
  if (data_off + entry.csize > size) {
    error = u"[ZipFile] entry data out of range: " + entry.name;
    return false;
  }
  const uint8_t* const raw = base + data_off;
  if (entry.method == 0) {
    out.assign(reinterpret_cast<const char*>(raw), entry.csize);
  } else if (entry.method == 8) {
    std::vector<uint8_t> inflated;
    if (!inflate_bytes(raw, entry.csize, inflated, error)) {
      error = u"[ZipFile] " + error + u": " + entry.name;
      return false;
    }
    out.assign(inflated.begin(), inflated.end());
  } else {
    error = u"[ZipFile] unsupported compression method " + as_u16(std::to_string(entry.method)) +
            u": " + entry.name;
    return false;
  }
  // 尺寸自检（TS 不做）：非 zip64 哨兵时，解出来的长度必须等于中央目录里记的 usize。
  if (entry.usize != 0xffffffffu && out.size() != entry.usize) {
    error = u"[ZipFile] size mismatch (" + as_u16(std::to_string(out.size())) + u" != " +
            as_u16(std::to_string(entry.usize)) + u"): " + entry.name;
    return false;
  }
  return true;
}

}  // namespace lfw::host
