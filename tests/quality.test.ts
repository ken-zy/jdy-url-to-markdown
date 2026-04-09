import { describe, expect, test } from "bun:test";
import { qualityCheck } from "../scripts/quality";

describe("qualityCheck", () => {
  test("passes for content with sufficient length and paragraphs", () => {
    const markdown = [
      "# Article Title",
      "",
      "This is the first paragraph with enough words to be considered useful content for the quality check.",
      "",
      "This is the second paragraph that also contains enough words to pass the useful paragraph threshold.",
      "",
      "And a third paragraph for good measure with plenty of words inside it to meet requirements.",
    ].join("\n");
    const result = qualityCheck(markdown);
    expect(result.pass).toBe(true);
    expect(result.stats!.usefulParagraphs).toBeGreaterThanOrEqual(2);
  });

  test("fails for content shorter than 120 chars", () => {
    const result = qualityCheck("Short text.");
    expect(result.pass).toBe(false);
    expect(result.reason).toContain("too short");
  });

  test("fails for anti-scraping markers", () => {
    const markdown = "# Page\n\nAccess Denied\n\nYou do not have permission to access this resource.";
    const result = qualityCheck(markdown);
    expect(result.pass).toBe(false);
    expect(result.reason).toContain("anti-scraping");
  });

  test("fails for login wall markers", () => {
    const markdown = "# Welcome\n\n请登录后查看完整内容。\n\n更多精彩内容等你来看。";
    const result = qualityCheck(markdown);
    expect(result.pass).toBe(false);
    expect(result.reason).toContain("login wall");
  });

  test("fails for content with only 1 useful paragraph", () => {
    const markdown = [
      "# Title",
      "",
      "This is the only real paragraph with enough words to be considered useful.",
      "",
      "![image](https://example.com/img.png)",
      "",
      "## Another heading",
    ].join("\n");
    const result = qualityCheck(markdown);
    expect(result.pass).toBe(false);
    expect(result.reason).toContain("paragraph");
  });

  test("counts Chinese characters correctly for useful paragraph", () => {
    const markdown = [
      "# 标题",
      "",
      "这是一段足够长的中文段落，包含了超过十五个中文字符，应该被认为是有用的段落。",
      "",
      "另一段中文内容，同样包含了足够多的中文字符，可以通过质量检查。",
    ].join("\n");
    const result = qualityCheck(markdown);
    expect(result.pass).toBe(true);
    expect(result.stats!.usefulParagraphs).toBeGreaterThanOrEqual(2);
  });

  test("rejects navigation fragments (link lists without prose)", () => {
    const markdown = [
      "# Site",
      "",
      "This is a paragraph with enough words to be considered potentially useful for content.",
      "",
      "[Home](/) [About](/about) [Contact](/contact) [Blog](/blog)",
    ].join("\n");
    const result = qualityCheck(markdown);
    expect(result.pass).toBe(false);
    expect(result.reason).toContain("paragraph");
  });

  test("detects Cloudflare challenge page", () => {
    const markdown = "# Checking your browser\n\nJust a moment...\n\nPlease wait while we verify your connection.";
    const result = qualityCheck(markdown);
    expect(result.pass).toBe(false);
    expect(result.reason).toContain("anti-scraping");
  });
});
