$(function(){
    let questions = [];
    let currentQuizIndex = 0;
    let userAnswers = [];
    let generateRequest = null;

    // 離開頁面時中斷尚未完成的題目生成請求
    window.addEventListener('pagehide', function() {
        if (generateRequest) {
            generateRequest.abort();
            generateRequest = null;
        }
    });

    // 網頁載入後自動呼叫後端 API，動態生成題目
    generateRequest = $.ajax({
        url: "/api/psych/generate_questions",
        type: "GET",
        success: function(response) {
            generateRequest = null;
            if(response.status === "success" && response.data.items.length > 0) {
                questions = response.data.items;
                $("#status-text").text("題目已生成完畢！準備好就可以開始囉。");
                $("#start-btn").show();
            }
        },
        error: function(xhr, status) {
            generateRequest = null;
            if (status === 'abort') return;
            $("#status-text").text("題目生成失敗，請檢查後端控制台。");
            console.error(xhr.responseText);
        }
    });

    // 點擊開始按鈕
    $("#start-btn").on("click", function(){
        $("#start-btn").hide();
        $("#status-text").hide();
        $("#question-area").show();
        renderQuestion();
    });

    // 渲染目前題目
    function renderQuestion() {
        let currentQ = questions[currentQuizIndex];
        $("#question-text").text(`第 ${currentQuizIndex + 1} 題：${currentQ.text}`);
        $("#options-area").empty();

        currentQ.options.forEach(function(opt) {
            let weightsStr = JSON.stringify(opt.weights);
            $("#options-area").append(
                `<label class='option-label'>
                    <input type='radio' name='psych_option' value='${opt.id}' data-weights='${weightsStr}'>
                    ${opt.text}
                </label>`
            );
        });

        if(currentQuizIndex === questions.length - 1) {
            $("#next-btn").text("送出看結果");
        }
    }

    // 點擊下一題
    $("#next-btn").on("click", function(){
        let selectedOption = $("input[name='psych_option']:checked");

        if(selectedOption.length === 0) {
            alert("請先選擇一個選項喔！");
            return;
        }

        userAnswers.push({
            question_id: questions[currentQuizIndex].question_id,
            answer: selectedOption.val(),
            weights: JSON.parse(selectedOption.attr("data-weights"))
        });

        currentQuizIndex++;

        if(currentQuizIndex < questions.length) {
            renderQuestion();
        } else {
            $("#question-area").html("<h2>測驗結束！</h2><p id='loading-result'>🧠 AI 諮商師正在精準計算分數並撰寫您的心靈報告，請稍候...</p>");

            $.ajax({
                url: "/api/psych/submit_answers",
                type: "POST",
                contentType: "application/json",
                data: JSON.stringify({ answers: userAnswers }),
                success: function(response) {
                    if (response.status === "success") {
                        let result = response.data;

                        let recHtml = "";
                        result.ai_recommendations.forEach(function(rec) {
                            recHtml += `<li style="margin-bottom: 8px;">${rec}</li>`;
                        });

                        $("#question-area").html(`
                            <h2 style="color: #ffffff;">🎉 測驗評估報告</h2>
                            <hr style="border-color: rgba(255,255,255,0.125);">
                            <div style="text-align: left; margin: 20px 0; line-height: 1.6; color: rgba(255,255,255,0.85);">
                                <p><strong>📊 檢測結果分類：</strong> <span style="font-size: 18px; color: #7985b0; font-weight: bold;">${result.category}</span></p>
                                <p><strong>🔍 量化指標（原始加總分）：</strong> 學習壓力 ${result.scale_scores.stress} 分 / 身心能量 ${result.scale_scores.energy} 分</p>
                                <br>
                                <p><strong>💌 AI 諮商師導師結語：</strong></p>
                                <p style="background: #454858; padding: 15px; border-left: 5px solid #4c5c96; border-radius: 4px; color: #ffffff;">${result.ai_summary}</p>
                                <br>
                                <p><strong>💡 專屬行動指南與建議：</strong></p>
                                <ul style="padding-left: 20px; color: rgba(255,255,255,0.65);">
                                    ${recHtml}
                                </ul>
                            </div>
                            <br>
                            <button onclick="window.location.reload();" style="margin-right: 12px;">重新測驗</button>
                            <button onclick="window.location.href='/dashboard/dashboard.html';" style="background-color: transparent; border: 1px solid rgba(255,255,255,0.3);">回儀表板</button>
                        `);
                    }
                },
                error: function(xhr) {
                    $("#loading-result").text("❌ 報告產出失敗，請確認後端 log 是否正確。");
                    console.error(xhr.responseText);
                }
            });
        }
    });
});
