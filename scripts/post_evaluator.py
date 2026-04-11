import json
import urllib.request
from datetime import datetime

def analyze_post_potential(title, content, category):
    """
    A simple mockup script to evaluate the potential of a Xiaohongshu post draft.
    Returns a score and suggestions based on length, emojis, and title keywords.
    """
    score = 50
    suggestions = []

    # Title check
    if len(title) > 20:
        suggestions.append("标题过长，建议控制在20字以内以防折叠。")
    if any(word in title for word in ['绝绝子', '天花板', '神器', '必看']):
        score += 10
    else:
        suggestions.append("标题缺乏情绪词或夸张词（如：必看、避坑、绝了等）。")

    # Content length check
    if len(content) < 50:
        suggestions.append("正文太短，建议增加细节描述，提高关键词命中率。")
    elif len(content) > 800:
        suggestions.append("正文太长，用户可能没有耐心看完，建议拆分为多篇或做成合集。")
    else:
        score += 15

    # Emoji check (simple approximation)
    if not any(char in content for char in ['✨', '🔥', '💡', '❤️', '😭', '✅', '❌']):
        suggestions.append("文案缺少 Emoji，小红书文案需要大量 Emoji 来进行排版和断句。")
    else:
        score += 10

    # Interaction check
    if '?' not in content and '？' not in content:
        suggestions.append("文案缺乏互动性问题，建议在结尾提问以引导评论。")
    else:
        score += 15

    return {
        "status": "success",
        "timestamp": datetime.now().isoformat(),
        "evaluation": {
            "estimated_score": min(score, 100),
            "category": category,
            "suggestions": suggestions
        }
    }

if __name__ == "__main__":
    # Example usage
    sample_title = "小户型收纳分享"
    sample_content = "今天整理了厨房，感觉好多了。主要用到了一些收纳盒。"
    result = analyze_post_potential(sample_title, sample_content, "家居")
    print(json.dumps(result, ensure_ascii=False, indent=2))