from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
import arxiv
import datetime
import io



app = Flask(__name__)
CORS(app)  # 允许所有来源的跨域请求

@app.route('/fetch_papers', methods=['GET'])
def fetch_papers_route():
    user_query = request.args.get('query', '').strip()
    days_str = request.args.get('days', '7').strip() # 默认为7天

    if not user_query:
        # 前端应该已经处理了空查询，但后端也做一次校验
        return jsonify({'message': '请输入搜索主题'}), 400

    try:
        days = int(days_str)
        if days <= 0:
            days = 7 # 如果用户输入0或负数，则默认为7天 (与用户要求一致)
    except ValueError:
        # 如果天数格式无效，也默认为7天
        days = 7
        # return jsonify({'message': '天数格式无效'}), 400 # 或者返回错误

    # 构建arXiv查询
    # 用户可以直接输入 'ti:"Language Models" AND (cat:cs.AI OR cat:cs.CL)' 这样的复杂查询
    # 或者简单输入 'Language Models'，我们会尝试将其作为标题搜索
    search_query = user_query
    # 如果用户没有指定字段（如ti:, au:, cat:），则默认为标题和摘要的模糊搜索
    if not any(field_prefix in user_query.lower() for field_prefix in ['ti:', 'au:', 'abs:', 'co:', 'jr:', 'cat:', 'rn:', 'id:', 'all:']):
        keywords = user_query.split()
        if keywords:
            # 构建 (ti:keyword1 OR abs:keyword1) AND (ti:keyword2 OR abs:keyword2) ... 的查询
            keyword_queries = [f'(ti:{keyword} OR abs:{keyword})' for keyword in keywords]
            search_query = ' AND '.join(keyword_queries)
        else:
            # 如果分割后没有关键词（例如用户只输入了空格），则保持原始查询或进行特定处理
            search_query = user_query # 或者可以返回错误提示用户输入有效关键词
    else:
        # 如果用户指定了字段，则使用用户的原始查询
        search_query = user_query

    # 计算日期范围
    # 我们要找的是从 'days' 天前的00:00:00 UTC 到今天的23:59:59 UTC 的论文
    today_utc_date = datetime.datetime.now(datetime.timezone.utc).date()
    start_date_limit = today_utc_date - datetime.timedelta(days=days -1) # N天前，包含今天，所以是 days-1

    try:
        search = arxiv.Search(
            query=search_query,
            max_results=100,  # 获取较多结果，后续按日期过滤
            sort_by=arxiv.SortCriterion.SubmittedDate,
            sort_order=arxiv.SortOrder.Descending
        )

        papers_data = []
        for result in search.results():
            paper_published_date_utc = result.published.date() # 取日期部分进行比较
            
            # 过滤掉早于 N 天前第一天的论文
            if paper_published_date_utc >= start_date_limit:
                papers_data.append({
                    'title': result.title,
                    'authors': [author.name for author in result.authors], # 添加作者信息
                    'summary': result.summary.replace('\n', ' ').strip(),
                    'pdf_url': result.pdf_url,
                    'published_date': result.published.strftime('%Y-%m-%d'), # 只保留日期
                    'updated_date': result.updated.strftime('%Y-%m-%d'),   # 只保留日期
                    'arxiv_id': result.entry_id.split('/')[-1]
                })
            # 由于结果已按提交日期降序排列，一旦论文日期早于我们的N天窗口，后续的也会早，可以提前停止
            # 但考虑到API可能返回少量不完全按序的结果，或者为了简单，可以处理完所有max_results
            # 增加一个判断，如果已经取到一些数据，并且当前论文已经超出了时间范围，就停止
            elif paper_published_date_utc < start_date_limit and len(papers_data) > 0:
                 break
        
        # 返回时，不再需要 success 字段，前端可以直接判断 papers 数组长度
        # 如果没有找到论文，返回空数组和提示信息
        if not papers_data:
            return jsonify({'papers': [], 'message': f'在最近 {days} 天内未找到关于 "{user_query}" 的论文。'}), 200

        return jsonify({'papers': papers_data}), 200

    except Exception as e:
        app.logger.error(f"Error fetching from arXiv: {e}")
        return jsonify({'message': f'从arXiv获取论文时出错: {str(e)}'}), 500

@app.route('/generate_report', methods=['POST']) # 改为POST，接收论文数据
def generate_report_route():
    try:
        data = request.get_json()
        if not data or 'papers' not in data:
            return jsonify({'message': '未提供论文数据'}), 400
        
        papers_to_report = data.get('papers')

        if not papers_to_report or not isinstance(papers_to_report, list):
            # 即使 'papers' 键存在，也可能其值不是列表或为空列表
            return jsonify({'message': '未提供有效的论文数据用于生成报告或论文列表为空'}), 400

        report_content = "# ArXiv 论文查找报告\n\n"
        report_content += f"报告生成时间: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"
        # query 和 days 信息现在由前端管理，如果需要可以在POST请求中也传递过来
        # report_content += f"查询条件: {data.get('query', '未知')}\n"
        # report_content += f"时间范围: 最近 {data.get('days', '未知')} 天\n\n"

        for paper in papers_to_report:
            report_content += f"## {paper.get('title', '无标题')}\n"
            authors = paper.get('authors', []) # 前端已确保有authors
            report_content += f"**作者:** {', '.join(authors) if authors else '未知作者'}\n"
            report_content += f"**发布日期:** {paper.get('published_date', '未知日期')}\n"
            report_content += f"**摘要:** {paper.get('summary', '无摘要')}\n"
            report_content += f"**PDF链接:** {paper.get('pdf_url', '#')}\n\n"
            report_content += "---\n\n"

        report_io = io.BytesIO()
        report_io.write(report_content.encode('utf-8'))
        report_io.seek(0)
        
        return send_file(
            report_io,
            mimetype='text/markdown',
            as_attachment=True,
            download_name='arxiv_papers_report.md'
        )

    except Exception as e:
        app.logger.error(f"Error generating report: {e}")
        return jsonify({'message': f'生成报告时出错: {str(e)}'}), 500

if __name__ == '__main__':
    # 确保监听所有接口，方便外部访问，例如在Docker容器中
    app.run(debug=True, host='0.0.0.0', port=5000)