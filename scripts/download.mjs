import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${bytes} B`;
}

function formatSpeed(bytesPerSec) {
  if (bytesPerSec >= 1024 * 1024) return `${(bytesPerSec / 1024 / 1024).toFixed(2)} MB/s`;
  if (bytesPerSec >= 1024) return `${(bytesPerSec / 1024).toFixed(2)} KB/s`;
  return `${bytesPerSec.toFixed(0)} B/s`;
}

export async function download(url, dir = __dirname, options = {}) {
  // 默认配置
  const {
    timeout = 15000, // 超时15秒
    retry = 2, // 重试2次
    showProgress = true, // 显示进度
  } = options;

  // 协议判断
  const client = url.startsWith('https') ? https : http;

  // 下载逻辑（支持重试）
  const execute = (attempt = 1) => {
    return new Promise((resolve, reject) => {
      const req = client.get(url, (res) => {
        // 状态码异常
        if (res.statusCode < 200 || res.statusCode >= 400) {
          const err = new Error(`请求失败，状态码：${res.statusCode}`);
          err.code = res.statusCode;
          return reject(err);
        }

        // 自动获取文件名
        let filename = 'unknown-file';
        const disposition = res.headers['content-disposition'];
        if (disposition && disposition.includes('filename=')) {
          filename = disposition.split('filename=')[1].replace(/["']/g, '').trim();
        } else {
          filename = path.basename(url) || `file-${Date.now()}`;
        }
        const savePath = path.join(dir, filename);

        // 总大小
        const totalSize = parseInt(res.headers['content-length'], 10) || 0;
        let downloadedSize = 0;
        const startTime = Date.now();

        // 写入流
        const writeStream = fs.createWriteStream(savePath);
        res.pipe(writeStream);

        // 统计与进度条（含下载速度）
        res.on('data', (chunk) => {
          downloadedSize += chunk.length;
          if (showProgress && totalSize > 0) {
            const percent = ((downloadedSize / totalSize) * 100).toFixed(2);
            const elapsed = (Date.now() - startTime) / 1000 || 1;
            const speed = downloadedSize / elapsed;
            process.stdout.write(
              `\r下载进度：${percent}% (${formatSize(downloadedSize)}/${formatSize(totalSize)}) 速度：${formatSpeed(speed)}`
            );
          }
        });

        // 完成
        writeStream.on('finish', () => {
          writeStream.close();
          const elapsed = (Date.now() - startTime) / 1000 || 1;
          const speed = downloadedSize / elapsed;
          console.log(`\n下载完成：${savePath} (${formatSize(downloadedSize)}) 平均速度：${formatSpeed(speed)}`);
          resolve(savePath);
        });

        // 写入错误
        writeStream.on('error', (err) => {
          fs.unlinkSync(savePath); // 删除损坏文件
          reject(new Error(`写入失败：${err.message}`));
        });
      });

      // 超时
      req.setTimeout(timeout, () => {
        req.destroy();
        reject(new Error(`请求超时 ${timeout}ms`));
      });

      // 请求错误
      req.on('error', (err) => {
        reject(new Error(`请求异常：${err.message}`));
      });
    });
  };

  // 重试机制
  let attempt = 1;
  while (attempt <= retry + 1) {
    try {
      return await execute(attempt);
    } catch (err) {
      if (attempt > retry) throw err;
      console.log(`\n下载失败，${attempt}/${retry} 重试：${err.message}`);
      attempt++;
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
}
