set -e
API=http://localhost:4000/api
j() { curl -s -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' "$@"; }
TOKEN=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"email":"ceo@eacompany.kr","password":"changeme123!"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["accessToken"])')
echo "login ok"
BT=$(j $API/business-types | python3 -c 'import sys,json;d=json.load(sys.stdin);print(next(x["id"] for x in d if x["code"]=="BUILD"))')
DEV=$(j $API/departments | python3 -c 'import sys,json;d=json.load(sys.stdin);print(next(x["id"] for x in d if x["code"]=="DEV"))')
RES=$(j $API/departments | python3 -c 'import sys,json;d=json.load(sys.stdin);print(next(x["id"] for x in d if x["code"]=="RESEARCH"))')
BANK=$(j $API/treasury/bank-accounts | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d[0]["id"])')
GOV=$(j $API/treasury/bank-accounts | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d[1]["id"])')
# 기초잔액 설정
j -X PATCH $API/treasury/bank-accounts/$BANK -d '{"openingBalance":"150000000","openingDate":"2026-01-01"}' >/dev/null
j -X PATCH $API/treasury/bank-accounts/$GOV -d '{"openingBalance":"50000000","openingDate":"2026-01-01"}' >/dev/null
# 프로젝트
P=$(j -X POST $API/projects -d "{\"code\":\"P-2026-001\",\"name\":\"A병원 시스템 구축\",\"businessTypeId\":\"$BT\",\"leadDepartmentId\":\"$DEV\",\"departmentIds\":[\"$RES\"],\"status\":\"ACTIVE\",\"startDate\":\"2026-07-01\",\"planEndDate\":\"2026-12-31\",\"contractAmount\":\"100000000\",\"budgetAmount\":\"60000000\"}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
echo "project $P"
for t in "요구사항 분석" "DB 설계" "API 개발" "프론트 개발" "테스트"; do j -X POST $API/projects/$P/tasks -d "{\"title\":\"$t\"}" >/dev/null; done
T1=$(j $API/projects/$P/tasks | python3 -c 'import sys,json;print(json.load(sys.stdin)[0]["id"])')
j -X PATCH $API/tasks/$T1 -d '{"status":"DONE"}' >/dev/null
T2=$(j $API/projects/$P/tasks | python3 -c 'import sys,json;d=[x for x in json.load(sys.stdin) if not x["isDone"]];print(d[0]["id"])')
j -X PATCH $API/tasks/$T2 -d '{"isDone":true}' >/dev/null
echo "progress: $(j $API/projects/$P | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d["doneTasks"],"/",d["totalTasks"],"=",d["progress"],"%")')"
# 거래: 매출 발생(미수) 1억(부가세 1천만) / 외주비 즉시출금 4천만 / 임대료 판관비 미지급 500만 / 선급비용 1200만 / 계약부채 선결제
D=$(date +%F)
j -X POST $API/journal -d "{\"type\":\"SALES\",\"entryDate\":\"$D\",\"amount\":\"100000000\",\"vatAmount\":\"10000000\",\"memo\":\"1차 검수 매출\",\"dims\":{\"projectId\":\"$P\"}}" | python3 -c 'import sys,json;d=json.load(sys.stdin);print("SALES entry", d["entryNo"], "lines", len(d["lines"]))'
COGS=$(j $API/accounts | python3 -c 'import sys,json;d=json.load(sys.stdin);print(next(x["id"] for x in d if x["systemKey"]=="COGS_DEFAULT"))')
j -X POST $API/journal -d "{\"type\":\"CASH_EXPENSE\",\"entryDate\":\"$D\",\"amount\":\"40000000\",\"vatAmount\":\"4000000\",\"accountId\":\"$COGS\",\"bankAccountId\":\"$BANK\",\"memo\":\"외주개발비\",\"dims\":{\"projectId\":\"$P\"}}" | python3 -c 'import sys,json;d=json.load(sys.stdin);print("CASH_EXPENSE entry", d["entryNo"])'
j -X POST $API/journal -d "{\"type\":\"EXPENSE\",\"entryDate\":\"$D\",\"amount\":\"5000000\",\"memo\":\"프로젝트 관련 수수료(미지급)\",\"dims\":{\"projectId\":\"$P\"}}" >/dev/null
j -X POST $API/journal -d "{\"type\":\"PREPAID\",\"entryDate\":\"$D\",\"amount\":\"12000000\",\"bankAccountId\":\"$BANK\",\"memo\":\"사무실 임대료 1년 선납\",\"dims\":{\"departmentId\":\"$DEV\"}}" >/dev/null
j -X POST $API/journal -d "{\"type\":\"PREPAID_AMORTIZE\",\"entryDate\":\"$D\",\"amount\":\"1000000\",\"memo\":\"8월 임차료\",\"dims\":{\"departmentId\":\"$DEV\"}}" >/dev/null
# 잘못된 분개: 불일치 검증
j -X POST $API/journal -d "{\"type\":\"MANUAL\",\"entryDate\":\"$D\",\"lines\":[{\"accountId\":\"$COGS\",\"debit\":\"100\"}]}" | python3 -c 'import sys,json;print("MANUAL unbalanced ->", json.load(sys.stdin)["message"])'
# 유보금 / 지급예정
R=$(j -X POST $API/treasury/reserves -d '{"category":"INVESTMENT","purpose":"건물 매입 준비","amount":"50000000"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
j -X POST $API/treasury/reserves/$R/move -d '{"type":"RELEASE","amount":"10000000","reason":"계약금 집행"}' >/dev/null
j -X POST $API/treasury/planned-payments -d '{"kind":"CONFIRMED","title":"8월 급여","category":"PAYROLL","amount":"30000000","dueDate":"2026-08-25"}' >/dev/null
j -X POST $API/treasury/planned-payments -d '{"kind":"PLANNED","title":"장비 구입 계획","amount":"20000000","dueDate":"2026-10-01"}' >/dev/null
# 은행 CSV import + 분류
j -X POST $API/treasury/bank-transactions/import -d "{\"bankAccountId\":\"$BANK\",\"rows\":[{\"txnAt\":\"${D}T10:00:00+09:00\",\"direction\":\"IN\",\"amount\":\"110000000\",\"counterpartyRaw\":\"A병원\",\"descriptionRaw\":\"1차 대금\",\"externalId\":\"x1\"},{\"txnAt\":\"${D}T10:00:00+09:00\",\"direction\":\"IN\",\"amount\":\"110000000\",\"externalId\":\"x1\"}]}"; echo
BTX=$(j "$API/treasury/bank-transactions?status=UNCLASSIFIED" | python3 -c 'import sys,json;print(json.load(sys.stdin)[0]["id"])')
j -X POST $API/journal -d "{\"type\":\"RECEIPT_AR\",\"entryDate\":\"$D\",\"amount\":\"100000000\",\"vatAmount\":\"10000000\",\"bankAccountId\":\"$BANK\",\"bankTransactionId\":\"$BTX\",\"memo\":\"A병원 1차 대금 회수\",\"dims\":{\"projectId\":\"$P\"}}" | python3 -c 'import sys,json;d=json.load(sys.stdin);print("RECEIPT_AR linked bank txn:", d["bankClassifications"][0]["status"])'
echo "---- DASHBOARD ----"
j "$API/metrics/dashboard?preset=this_month" | python3 -c '
import sys,json;d=json.load(sys.stdin)
p=d["pnl"];t=d["treasury"];pr=d["projects"]
print("매출",p["sales"],"원가",p["cogs"],"매출총이익",p["grossProfit"],"판관비",p["sga"],"영업이익",p["operatingProfit"],"영업이익률",p["operatingMarginPct"])
print("총잔액",t["totalBalance"],"제한계좌",t["restrictedBalance"],"유보금",t["reserveTotal"],"확정지급예정",t["plannedConfirmed"],"가용현금",t["availableCash"])
print("오늘 입금",t["todayIn"],"출금",t["todayOut"],"순현금",t["todayNet"],"30일예상",t["forecast"]["d30"])
print("프로젝트",pr["total"],"진행",pr["active"],"업무완수율",pr["taskCompletionPct"])
print("사업별:",[(r["name"],r["sales"],r["operatingProfit"]) for r in d["byBusinessType"]])
print("부서별:",[(r["name"],r["sales"],r["operatingProfit"]) for r in d["byDepartment"]])'
j "$API/metrics/pnl/breakdown?groupBy=project&preset=this_month" | python3 -c 'import sys,json;d=json.load(sys.stdin);print("프로젝트별:",[(r["name"],r["sales"],r["cogs"],r["operatingProfit"],r["operatingMarginPct"]) for r in d["rows"]])'
# 권한 테스트: 직원 생성 → 자금 접근 차단
E=$(j -X POST $API/users -d "{\"email\":\"dev1@eacompany.kr\",\"password\":\"password123\",\"name\":\"개발자1\",\"departmentId\":\"$DEV\"}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
ET=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"email":"dev1@eacompany.kr","password":"password123"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["accessToken"])')
echo "직원 treasury 접근: $(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $ET" $API/metrics/treasury)  직원 pnl 접근: $(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $ET" $API/metrics/pnl)  직원 프로젝트 수: $(curl -s -H "Authorization: Bearer $ET" $API/projects | python3 -c 'import sys,json;print(len(json.load(sys.stdin)))')"
j -X PUT $API/users/$E/role-scopes -d "[{\"role\":\"ADMIN\",\"scopeType\":\"DEPARTMENT\",\"departmentId\":\"$RES\"}]" >/dev/null
echo "연구팀 ADMIN 부여 후 프로젝트 수: $(curl -s -H "Authorization: Bearer $ET" $API/projects | python3 -c 'import sys,json;print(len(json.load(sys.stdin)))')  pnl: $(curl -s -H "Authorization: Bearer $ET" "$API/metrics/pnl" | python3 -c 'import sys,json;d=json.load(sys.stdin);print("매출",d["sales"])')"
echo "audit logs: $(j $API/audit-logs | python3 -c 'import sys,json;d=json.load(sys.stdin);print(len(d), sorted(set(x["action"] for x in d)))')"
