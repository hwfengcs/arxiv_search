document.addEventListener('DOMContentLoaded', () => {
    const fetchPapersBtn = document.getElementById('fetch-papers-btn');
    const papersOutput = document.getElementById('papers-output');
    const downloadReportBtn = document.getElementById('download-report-btn');
    const searchQueryInput = document.getElementById('search-query-input');
    const timeLimitInput = document.getElementById('time-limit-input');
    const translateCheckbox = document.getElementById('translate-checkbox');

    let fetchedPapersData = []; // 用于存储获取的论文数据

    fetchPapersBtn.addEventListener('click', async () => {
        const query = searchQueryInput.value.trim(); // 用户输入的主题
        const days = timeLimitInput.value.trim() || '7'; // 默认7天或用户输入
        const shouldTranslate = translateCheckbox.checked; // 是否翻译

        if (!query) {
            papersOutput.innerHTML = '<p style="color: red;">请输入搜索主题！</p>';
            downloadReportBtn.style.display = 'none';
            return;
        }

        papersOutput.innerHTML = '<p>正在查找论文，请稍候...</p>';
        downloadReportBtn.style.display = 'none'; // 获取时隐藏下载按钮

        try {
            // 使用 127.0.0.1 保持与原脚本一致，添加翻译参数
            const response = await fetch(`http://127.0.0.1:5000/fetch_papers?query=${encodeURIComponent(query)}&days=${encodeURIComponent(days)}&translate=${shouldTranslate}`);
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

            // 检查是否有翻译内容
            const hasTranslation = paper.title_zh || paper.summary_zh;
            const displayTitle = hasTranslation && paper.title_zh ? paper.title_zh : paper.title;
            const displaySummary = hasTranslation && paper.summary_zh ? paper.summary_zh : paper.summary;

            let translationToggle = '';
            if (hasTranslation) {
                translationToggle = `
                    <div class="translation-controls">
                        <button class="toggle-translation-btn" data-paper-id="${paper.arxiv_id}">
                            ${paper.title_zh ? '显示原文' : '显示翻译'}
                        </button>
                    </div>
                `;
            }

            paperElement.innerHTML = `
                <h3 class="paper-title" data-original="${paper.title}" data-translated="${paper.title_zh || ''}">${displayTitle}</h3>
                <p class="authors"><strong>作者:</strong> ${paper.authors ? paper.authors.join(', ') : '未知作者'}</p>
                <p class="summary" data-original="${paper.summary}" data-translated="${paper.summary_zh || ''}"><strong>摘要:</strong> ${displaySummary}</p>
                <p class="meta-info"><strong>发布日期:</strong> ${paper.published_date}</p>
                <div class="paper-actions">
                    <a href="${paper.pdf_url}" target="_blank" class="pdf-link">查看PDF</a>
                    ${!hasTranslation ? `<button class="translate-btn" data-paper-id="${paper.arxiv_id}">翻译</button>` : ''}
                </div>
                ${translationToggle}
            `;
            papersOutput.appendChild(paperElement);
        });

        // 添加翻译按钮事件监听器
        addTranslationEventListeners();
    }

    function addTranslationEventListeners() {
        // 为翻译按钮添加事件监听器
        document.querySelectorAll('.translate-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const paperId = e.target.getAttribute('data-paper-id');
                const paperCard = e.target.closest('.paper-card');
                const titleElement = paperCard.querySelector('.paper-title');
                const summaryElement = paperCard.querySelector('.summary');

                const originalTitle = titleElement.getAttribute('data-original');
                const originalSummary = summaryElement.getAttribute('data-original');

                e.target.textContent = '翻译中...';
                e.target.disabled = true;

                try {
                    // 翻译标题
                    console.log('开始翻译标题:', originalTitle);
                    const titleResponse = await fetch('http://127.0.0.1:5000/translate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text: originalTitle })
                    });

                    // 翻译摘要
                    console.log('开始翻译摘要:', originalSummary.substring(0, 100) + '...');
                    const summaryResponse = await fetch('http://127.0.0.1:5000/translate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text: originalSummary })
                    });

                    console.log('标题响应状态:', titleResponse.status, titleResponse.ok);
                    console.log('摘要响应状态:', summaryResponse.status, summaryResponse.ok);

                    if (titleResponse.ok && summaryResponse.ok) {
                        const titleData = await titleResponse.json();
                        const summaryData = await summaryResponse.json();

                        console.log('标题翻译结果:', titleData);
                        console.log('摘要翻译结果:', summaryData);

                        // 检查翻译是否真的成功
                        if (titleData.translated_text && summaryData.translated_text) {
                            // 更新显示内容
                            titleElement.textContent = titleData.translated_text;
                            titleElement.setAttribute('data-translated', titleData.translated_text);
                            summaryElement.innerHTML = `<strong>摘要:</strong> ${summaryData.translated_text}`;
                            summaryElement.setAttribute('data-translated', summaryData.translated_text);

                            // 安全地替换翻译按钮为切换按钮
                            const button = e.target;
                            const actionsContainer = paperCard.querySelector('.paper-actions');

                            if (button && actionsContainer && actionsContainer.contains(button)) {
                                // 创建新的切换按钮
                                const newButton = document.createElement('button');
                                newButton.className = 'toggle-translation-btn';
                                newButton.setAttribute('data-paper-id', paperId);
                                newButton.textContent = '显示原文';

                                // 添加切换功能
                                newButton.addEventListener('click', (toggleEvent) => {
                                    const isShowingTranslation = toggleEvent.target.textContent === '显示原文';

                                    if (isShowingTranslation) {
                                        // 显示原文
                                        titleElement.textContent = originalTitle;
                                        summaryElement.innerHTML = `<strong>摘要:</strong> ${originalSummary}`;
                                        toggleEvent.target.textContent = '显示翻译';
                                    } else {
                                        // 显示翻译
                                        titleElement.textContent = titleData.translated_text;
                                        summaryElement.innerHTML = `<strong>摘要:</strong> ${summaryData.translated_text}`;
                                        toggleEvent.target.textContent = '显示原文';
                                    }
                                });

                                // 替换按钮
                                actionsContainer.replaceChild(newButton, button);
                                console.log('翻译成功完成');
                            } else {
                                console.error('无法替换按钮：找不到按钮容器或按钮不在容器中');
                                // 至少恢复按钮状态
                                if (button) {
                                    button.textContent = '翻译';
                                    button.disabled = false;
                                }
                            }
                        } else {
                            throw new Error('翻译结果为空');
                        }
                    } else {
                        // 获取错误详情
                        const titleError = titleResponse.ok ? null : await titleResponse.text().catch(() => 'Unknown error');
                        const summaryError = summaryResponse.ok ? null : await summaryResponse.text().catch(() => 'Unknown error');
                        throw new Error(`翻译请求失败 - 标题: ${titleResponse.status} ${titleError || 'OK'}, 摘要: ${summaryResponse.status} ${summaryError || 'OK'}`);
                    }
                } catch (error) {
                    console.error('翻译失败:', error);
                    alert(`翻译失败: ${error.message}`);
                    e.target.textContent = '翻译';
                    e.target.disabled = false;
                }
            });
        });

        // 为切换按钮添加事件监听器
        document.querySelectorAll('.toggle-translation-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const paperCard = e.target.closest('.paper-card');
                const titleElement = paperCard.querySelector('.paper-title');
                const summaryElement = paperCard.querySelector('.summary');

                const originalTitle = titleElement.getAttribute('data-original');
                const translatedTitle = titleElement.getAttribute('data-translated');
                const originalSummary = summaryElement.getAttribute('data-original');
                const translatedSummary = summaryElement.getAttribute('data-translated');

                const isShowingTranslation = e.target.textContent === '显示原文';

                if (isShowingTranslation) {
                    // 显示原文
                    titleElement.textContent = originalTitle;
                    summaryElement.innerHTML = `<strong>摘要:</strong> ${originalSummary}`;
                    e.target.textContent = '显示翻译';
                } else {
                    // 显示翻译
                    titleElement.textContent = translatedTitle;
                    summaryElement.innerHTML = `<strong>摘要:</strong> ${translatedSummary}`;
                    e.target.textContent = '显示原文';
                }
            });
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