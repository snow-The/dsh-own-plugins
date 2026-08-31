---
name: ocr-book-extract
description: Standardized extraction protocol for PaddleOCR-VL-1.6 generated Markdown books (files ending _by_PaddleOCR-VL-1.6.md). Use when the task involves reading or extracting knowledge from OCR-converted book files, big OCR markdown, or any 600KB-2MB single-file book corpus. Follows recon -> denoise -> chunked read -> structured extract so the work always completes without read-tool timeouts.
---

# OCR Book Extraction Protocol

PaddleOCR-VL-1.6 输出的书籍 MD 有统一格式规律(同一家 OCR、同一管线)。按本协议走,任何 agent 拿到任何一本都能一次通过,不会重蹈"read 大文件超时卡死"的覆辙。

## 1. 识别文件

- 文件名以 `_by_PaddleOCR-VL-1.6.md` 结尾(例:`Clean Code ( PDFDrive.com ).pdf_by_PaddleOCR-VL-1.6.md`)。
- 体量特征:600KB~1.9MB、1~3 万行。

## 2. 侦察(必做,秒级完成,禁止直接 read)

```powershell
# 文件大小与行数
(Get-Item $f).Length; (Get-Content $f -Encoding UTF8 | Measure-Object -Line).Lines
# 章节树:标题 + 行号,秒回
Select-String -Path $f -Pattern "^#{1,4} " | ForEach-Object { "$($_.LineNumber)`t$($_.Line)" }
```

- 得到章节边界(每章起始行号),这是后续分块的依据。
- **硬规则**:单文件 >7000 行或 >256KB 时,禁止 read 整读(worker 30s 超时死循环,6 个子代理全部卡死就是教训)。改用分块读取(见第 4 步)。阈值校准:1MB OCR ≈ 有效 ~256KB(实测空行+噪声占 ~47%)≈ 7,000 行代码等价,两条线指向同一量级(≈64K tokens)。
- **token 预算(必算)**:估算全书 tokens = 字符数 ÷ 3.7(实测 PaddleOCR 书平均 40~111 字符/行,约 11~30 tokens/行)。与 256K 窗口对比:全书 ≤ 60% 窗口可逐章全提;> 60% 先确认提取目标章节再动手;> 200% 只提取目标章节,禁止按章全提(实测:DDI0487G 483K 行 ≈ 31 个 256K 窗口,全提即灾难)。

## 3. 预处理(去噪,PowerShell 一次性完成)

PaddleOCR-VL-1.6 的两类固定噪声:

| 噪声 | 正则 | 说明 |
|---|---|---|
| 图片行 | `<div style="text-align:center;"><img` … `</div>` | 在线图片 URL(pplines-online.bj.bcebos.com),纯噪声 |
| 页码行 | `^\s*\d+\s*$` | 独立成行的页码,上下文是正文时保留 |

```powershell
Get-Content $f -Encoding UTF8 | Where-Object {
  $_ -notmatch "<img" -and $_ -notmatch "^\s*\d+\s*$"
} | Set-Content "$f.clean.md" -Encoding UTF8
```

## 4. 分块读取(核心,规避超时)

按章节行号范围切块,每块 300~800 行:

```powershell
# 读第 start~end 行(按侦察到的章节边界)
Get-Content $f -Encoding UTF8 -TotalCount $end | Select-Object -Skip ($start - 1)
```

每个章节块做一次结构化提取,提取完再读下一块;不要一次读多块。

## 5. 结构化提取(每块输出)

每块产出:

- **主题**:该块章节名
- **要点**:3~10 条可核验的要点(带原文行号引用)
- **代码/示例**:保留关键代码片段(注意 OCR 可能丢缩进/引号,引用时标注"OCR 转录")
- **术语**:本章出现的关键术语及书中定义

## 6. 统一输出 schema

所有提取结果落到单一 MD 文件,frontmatter 固定:

```yaml
---
source: <原始文件名>
ocr: PaddleOCR-VL-1.6
chapters: <章节数>
extracted_at: <ISO 时间>
---
```

正文结构:章节树(TOC)→ 每章一节(要点/代码/术语)→ 全书术语表 → 交叉引用索引。

## 常见 OCR 缺陷清单(引用时警惕)

- 标题级别混乱(## 与 #### 混用,OCR 判级不稳):以目录/章节语义为准,不轻信标题层级。
- 代码块缩进/引号丢失、行内符号错乱(如 `->` 变 `-`):引用代码前先做合理性判断。
- 中文/英文混排断行:段落可能被硬拆,提取时按语义合并。
- 重复段落:跨页重复出现,去重。

## 与其他 skill 的衔接

- 提取后要提炼纪律/规则 → 用 `coding-discipline` 的 30 条框架组织。
- 库吸收场景(ref/ → batch/out) → 按 lib-analyzer 的 libscan/libtasks 流程走,本协议负责其中的"读"环节。