// KV Clipboard

const KVCacheURL = "https://cache.ravelloh.top";
// const KVCacheURL = "http://localhost:3000";

async function stringToUUID(str) {
  // 将字符串转换为ArrayBuffer
  const encoder = new TextEncoder();
  const data = encoder.encode(str);

  // 使用SHA-1哈希函数进行哈希处理
  const hashBuffer = await crypto.subtle.digest("SHA-1", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  // 将哈希值转换为16进制字符串
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // 将哈希值转换为UUID格式
  // 注意：UUID的版本和变体位需要被设置为特定值
  // 这里我们设置版本为4（随机生成的UUID），变体为10xx（RFC 4122）
  const uuid = [
    hashHex.substring(0, 8),
    hashHex.substring(8, 12),
    hashHex.substring(12, 16),
    hashHex.substring(16, 20),
    // 截取20到32位，并设置版本和变体位
    hashHex.substring(20, 24) +
      "4" + // 设置版本为4
      hashHex.substring(24, 36), // 变体位10xx
  ].join("-");

  return uuid;
}

function copy() {
  // 复制div.textarea中的内容到剪切板
  navigator.clipboard.writeText(document.querySelector("textarea").value);
  message("复制成功");
}

function clearclipboard() {
  deleteClipboard(document.querySelector("#uuid").innerHTML, "")
    .then((response) => response.json())
    .then((data) => {
      document.querySelector("#status").innerHTML = data.message;

      console.log(data);

      window.location.reload();
    })
    .catch((error) => {
      alert(error);
    });
}

async function refresh(password = "") {
  if (
    password == "" &&
    document.querySelector("#password").innerHTML !== "..." &&
    document.querySelector("#password").innerHTML !== "未设置"
  ) {
    password = document.querySelector("#password").innerHTML;
  }
  // 预先检查
  document.querySelector("#name").innerHTML = window.location.pathname.replace(
    "/",
    ""
  );
  // 生成uuid
  const uuid = (
    await stringToUUID(window.location.pathname.replace("/", ""))
  ).substring(0, 36);
  document.querySelector("#uuid").innerHTML = uuid;
  getClipboard(uuid, password, false)
    .then((response) => response.json())
    .then((data) => {
      if (data.message == "未找到数据") {
        document.querySelector("#status").innerHTML = "无内容，请在下方编辑";
        document.querySelector("#password").innerHTML = "未设置";
        document.querySelector("#ip-protect").innerHTML = "未设置";
        document.querySelector("#time").innerHTML = "未设置";
      } else if (data.message == "无效的密码") {
        window.insightflare?.track("password_required");
        refresh(prompt("请输入密码"));
      } else {
        document.querySelector("#status").innerHTML = data.message;
        document.querySelector("textarea").value = data.data;
        document.querySelector("#password").innerHTML =
          data.password || "未设置";
        document.querySelector("#ip-protect").innerHTML = data.safeIP;
        document.querySelector("#time").innerHTML = data.expiredAt;

        // 检查是否为图片
        handleTextChange();

        window.insightflare?.track("clipboard_loaded", {
          is_image: isBase64Image(data.data),
          has_password: !!data.password,
          has_ip_protect: !!(data.safeIP && data.safeIP !== "未设置"),
        });
      }
      console.log(data);
    })
    .catch((error) => {
      alert(error);
    });
}

function setClipboard(data, password, safeIP, expiredTime, uuid) {
  // 处理 expiredTime，支持 ISO 字符串或毫秒数
  let expiredMs = expiredTime;
  if (typeof expiredTime === "string" && !/^\d+$/.test(expiredTime)) {
    // 如果是 ISO 字符串，转换为毫秒差值
    expiredMs = new Date(expiredTime).getTime() - Date.now();
    // 防止负数
    if (expiredMs < 0) expiredMs = 0;
  }

  return fetch(`${KVCacheURL}/api?mode=set`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data: data,
      password: password,
      safeIP: safeIP,
      expiredTime: expiredMs,
      uuid: uuid,
    }),
  });
}

function save() {
  const data = document.querySelector("textarea").value;

  // 检查内容长度是否超过1MB
  if (data.length > 1024 * 1024) {
    message("内容长度超过1MB，无法保存");
    document.querySelector("#status").innerHTML =
      "错误: 内容过长，请减少内容后再提交";
    window.insightflare?.track("content_oversize", {
      size_kb: Math.round(data.length / 1024),
    });
    return; // 终止保存过程
  }

  const password = document
    .querySelector("#password")
    .innerHTML.replace("未设置", "");
  const safeIP = document
    .querySelector("#ip-protect")
    .innerHTML.replace("未设置", "");
  const expiredTime = document
    .querySelector("#time")
    .innerHTML.replace("未设置", 365 * 24 * 60 * 60 * 1000);
  const uuid = document.querySelector("#uuid").innerHTML;

  // 状态提示
  document.querySelector("#status").innerHTML = "正在保存...";

  setClipboard(data, password, safeIP, expiredTime, uuid)
    .then((response) => response.json())
    .then((result) => {
      document.querySelector("#status").innerHTML = result.message;
      document.querySelector("#password").innerHTML = result.password || "未设置";
      document.querySelector("#ip-protect").innerHTML = result.safeIP || "未设置";
      document.querySelector("#time").innerHTML = result.expiredAt || "未设置";
      message("保存成功");
      window.insightflare?.track("save_success", {
        is_image: isBase64Image(data),
        has_password: !!result.password,
        has_ip_protect: !!result.safeIP,
        size_kb: Math.round(data.length / 1024),
      });
    })
    .catch((error) => {
      document.querySelector("#status").innerHTML = "保存失败";
      console.error("保存过程出错:", error);
      window.insightflare?.track("save_failed", {
        error: String(error).slice(0, 100),
      });
      alert("保存失败: " + error);
    });
}

function getClipboard(uuid, password, shouldDelete) {
  return fetch(`${KVCacheURL}/api?mode=get`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      uuid: uuid,
      password: password,
      shouldDelete: shouldDelete,
    }),
  });
}

function deleteClipboard(uuid, password) {
  return fetch(`${KVCacheURL}/api?mode=del`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      uuid: uuid,
    }),
  });
}

// 图片处理相关函数

// 将图片转换为Base64
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
}

// 检测字符串是否为Base64图片
function isBase64Image(str) {
  if (!str || typeof str !== "string") return false;

  // 基本格式检查: data:image/[type];base64,[data]
  const regex = /^data:image\/(jpeg|jpg|png|gif|bmp|webp|svg\+xml);base64,/;
  return regex.test(str);
}

// 从Base64计算图片大小（单位：KB）
function getBase64Size(base64String) {
  // 去掉data:image部分
  const split = base64String.split(",");
  const base64 = split.length > 1 ? split[1] : split[0];
  // 计算Base64解码后的大小
  const sizeInBytes =
    (base64.length * 3) / 4 -
    (base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0);
  return (sizeInBytes / 1024).toFixed(2);
}

// 显示图片预览
function showImagePreview(base64Image) {
  const container = document.getElementById("image-preview-container");
  const preview = document.getElementById("image-preview");
  const info = document.getElementById("image-info");

  preview.src = base64Image;

  // 等待图片加载完成后更新信息
  preview.onload = () => {
    const width = preview.naturalWidth;
    const height = preview.naturalHeight;
    const size = getBase64Size(base64Image);

    info.textContent = `尺寸: ${width}×${height} | 大小: ${size}KB`;
    container.classList.remove("hidden");
  };
}

// 关闭图片预览
function closeImagePreview() {
  document.getElementById("image-preview-container").classList.add("hidden");
}

// 处理文本内容变化，检测是否为图片
function handleTextChange() {
  const content = document.querySelector("textarea").value.trim();
  if (isBase64Image(content)) {
    showImagePreview(content);
  } else if (
    !document
      .getElementById("image-preview-container")
      .classList.contains("hidden")
  ) {
    closeImagePreview();
  }
}

// 处理图片上传
async function handleImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    document.querySelector("#status").innerHTML = "正在处理图片...";

    // 检查文件大小（限制为5MB）
    if (file.size > 5 * 1024 * 1024) {
      message("图片过大，请选择5MB以下的图片");
      window.insightflare?.track("image_oversize", {
        size_kb: Math.round(file.size / 1024),
        type: file.type,
      });
      return;
    }

    // 转换为Base64
    const base64 = await fileToBase64(file);

    // 检查Base64内容长度是否超过1MB
    if (base64.length > 1024 * 1024) {
      message("图片转换后超过1MB，无法保存");
      document.querySelector("#status").innerHTML =
        "错误: 内容过长，请选择小一些的图片";
      window.insightflare?.track("image_convert_oversize", {
        file_kb: Math.round(file.size / 1024),
        base64_kb: Math.round(base64.length / 1024),
        type: file.type,
      });
      return;
    }

    // 更新文本区域
    document.querySelector("textarea").value = base64;

    // 显示预览
    showImagePreview(base64);

    // 直接更新状态，不使用message函数临时显示
    document.querySelector("#status").innerHTML = "图片已添加，可以点击保存";

    window.insightflare?.track("image_uploaded", {
      size_kb: Math.round(file.size / 1024),
      type: file.type,
    });
  } catch (error) {
    console.error("处理图片失败:", error);
    document.querySelector("#status").innerHTML =
      "处理图片失败: " + error.message;
    window.insightflare?.track("image_upload_failed", {
      error: String(error.message || error).slice(0, 100),
    });
  }
}

// 初始化函数增加图片处理相关事件绑定
async function main() {
  // 若为主页，随机跳转
  if (
    window.location.pathname === "/" ||
    window.location.pathname === "/404.html" ||
    window.location.pathname === "/index.html"
  ) {
    // 随机生成4位字符串
    const randomString = Math.random().toString(36).substring(2, 6);
    window.location.href = "/" + randomString;
  } else {
    // 添加文件上传事件监听
    document
      .getElementById("image-upload")
      .addEventListener("change", handleImageUpload);

    // 添加上传按钮点击事件 - 修复上传按钮无反应问题
    const uploadButton = document.querySelector(".upload-btn button");
    if (uploadButton) {
      uploadButton.addEventListener("click", function (e) {
        e.preventDefault(); // 阻止默认行为
        document.getElementById("image-upload").click(); // 触发文件选择
      });
    }

    // 添加文本变化事件监听
    document
      .querySelector("textarea")
      .addEventListener("input", handleTextChange);

    // 刷新内容
    await refresh();
  }
}

function message(message) {
  const origin = document.querySelector("#status").innerHTML;
  document.querySelector("#status").innerHTML = message;
  setTimeout(() => {
    document.querySelector("#status").innerHTML = origin;
  }, 2000);
}

function setpassword() {
  document.querySelector("#password").innerHTML = prompt("请输入密码");
}

function setip() {
  fetch("https://ip.api.ravelloh.top")
    .then((response) => response.json())
    .then((data) => {
      document.querySelector("#ip-protect").innerHTML = prompt(
        `请输入IP(当前IP为${data.ip})`
      );
    });
}

function settime() {
  let hour = prompt("请输入过期时间(单位为小时)");
  document.querySelector("#time").innerHTML = new Date(
    Date.now() + hour * 60 * 60 * 1000
  ).toISOString();
}

function copyRaw() {
  navigator.clipboard.writeText(
    `${KVCacheURL}?uuid=${document.querySelector("#uuid").innerHTML}${
      document.querySelector("#password").innerHTML !== "未设置" &&
      document.querySelector("#password").innerHTML !== ""
        ? `&password=${document.querySelector("#password").innerHTML}`
        : ""
    }`
  );
  message("已复制");
}
main();
