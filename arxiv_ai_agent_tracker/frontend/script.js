document.addEventListener('DOMContentLoaded', () => {
    const fetchPapersBtn = document.getElementById('fetch-papers-btn');
    const papersOutput = document.getElementById('papers-output');
    const downloadReportBtn = document.getElementById('download-report-btn');
    const searchQueryInput = document.getElementById('search-query-input');
    const timeLimitInput = document.getElementById('time-limit-input');

    let fetchedPapersData = []; // 用于存储获取的论文数据

    fetchPapersBtn.addEventListener('click', async () => {
        const query = searchQueryInput.value.trim(); // 用户输入的主题
        const days = timeLimitInput.value.trim() || '7'; // 默认7天或用户输入

        if (!query) {
            papersOutput.innerHTML = '<p style="color: red;">请输入搜索主题！</p>';
            downloadReportBtn.style.display = 'none';
            return;
        }

        papersOutput.innerHTML = '<p>正在查找论文，请稍候...</p>';
        downloadReportBtn.style.display = 'none'; // 获取时隐藏下载按钮

        try {
            // 使用 127.0.0.1 保持与原脚本一致
            const response = await fetch(`http://127.0.0.1:5000/fetch_papers?query=${encodeURIComponent(query)}&days=${encodeURIComponent(days)}`);
            // 检查 response.ok 而不是 data.success，因为 fetch API 的 response.ok 表示 HTTP 状态码在 200-299 之间
            if (!response.ok) { 
                const errorData = await response.json().catch(() => ({ message: `HTTP error! status: ${response.status}` }));
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            fetchedPapersData = await response.json();
            // 后端返回的数据结构是 { papers: [...] } 或直接是 [...]，这里假设是 { papers: [...] }
            // 如果后端直接返回数组，则用 fetchedPapersData 替换 fetchedPapersData.papers
            displayPapers(fetchedPapersData.papers || fetchedPapersData); 
            if (fetchedPapersData.papers && fetchedPapersData.papers.length > 0) {
                downloadReportBtn.style.display = 'inline-block';
            } else if (Array.isArray(fetchedPapersData) && fetchedPapersData.length > 0){
                downloadReportBtn.style.display = 'inline-block';
            } else {
                downloadReportBtn.style.display = 'none';
            }
        } catch (error) {
            papersOutput.innerHTML = `<p style="color: red;">获取论文失败: ${error.message}</p>`;
            console.error('获取论文失败:', error);
            downloadReportBtn.style.display = 'none';
        }
    });

    function displayPapers(papers) {
        if (!papers || papers.length === 0) {
            papersOutput.innerHTML = '<p>未找到符合条件的论文。请尝试其他关键词或时间范围。</p>';
            return;
        }
        papersOutput.innerHTML = ''; // 清空现有内容
        papers.forEach(paper => {
            const paperElement = document.createElement('div');
            paperElement.classList.add('paper-card'); // 使用新的类名 'paper-card'
            paperElement.innerHTML = `
                <h3>${paper.title}</h3>
                <p class="authors"><strong>作者:</strong> ${paper.authors ? paper.authors.join(', ') : '未知作者'}</p>
                <p class="summary"><strong>摘要:</strong> ${paper.summary}</p>
                <p class="meta-info"><strong>发布日期:</strong> ${paper.published_date}</p>
                <a href="${paper.pdf_url}" target="_blank" class="pdf-link">查看PDF</a>
            `;
            papersOutput.appendChild(paperElement);
        });
    }

    downloadReportBtn.addEventListener('click', async () => {
        // 使用 fetchedPapersData 进行报告生成，确保数据一致性
        if (!fetchedPapersData || (Array.isArray(fetchedPapersData) && fetchedPapersData.length === 0) || (fetchedPapersData.papers && fetchedPapersData.papers.length === 0) ) {
            alert('当前没有论文数据可供下载。');
            return;
        }
        try {
            const papersForReport = fetchedPapersData.papers || fetchedPapersData;
            const response = await fetch('http://127.0.0.1:5000/generate_report', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ papers: papersForReport })
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: `HTTP error! status: ${response.status}` }));
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'arxiv_papers_report.md';
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('下载报告失败:', error);
            alert(`下载报告失败: ${error.message}`);
        }
    });
});