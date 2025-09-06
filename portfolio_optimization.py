#!/usr/bin/env python3
"""
投資ポートフォリオ最適化問題
整数計画問題（0-1ナップサック問題）として定式化
全列挙による解法
"""

def solve_portfolio_optimization():
    """
    投資ポートフォリオ最適化問題を解決（全列挙による解法）
    """
    print("=== 投資ポートフォリオ最適化問題の結果 ===")
    
    # プロジェクトの定義
    projects = [
        {"name": "A", "investment": 500, "return": 600},
        {"name": "B", "investment": 400, "return": 500},
        {"name": "C", "investment": 300, "return": 400}
    ]
    
    budget_limit = 1000
    best_solution = None
    best_return = 0
    
    # 2^3 = 8通りの組み合わせを検討
    for i in range(8):
        # バイナリ表現で各プロジェクトの選択を決定
        selected = []
        total_investment = 0
        total_return = 0
        
        for j, project in enumerate(projects):
            if (i >> j) & 1:  # j番目のビットが1かどうか
                selected.append(project["name"])
                total_investment += project["investment"]
                total_return += project["return"]
        
        # 予算制約をチェック
        feasible = total_investment <= budget_limit
        
        if feasible and total_return > best_return:
            best_return = total_return
            best_solution = {
                "selected": selected,
                "investment": total_investment,
                "return": total_return,
                "binary": i
            }
    
    # 最適解の表示
    print(f"最適解の目的関数値: {best_solution['return']}万円")
    print()
    
    print("最適な投資ポートフォリオ:")
    for project in projects:
        is_selected = project["name"] in best_solution["selected"]
        print(f"プロジェクト{project['name']}: {'投資する' if is_selected else '投資しない'} (投資額: {project['investment']}万円, 期待収益: {project['return']}万円)")
    
    print()
    print(f"総投資額: {best_solution['investment']}万円")
    print(f"総期待収益: {best_solution['return']}万円")
    print(f"予算制約: {best_solution['investment']}万円 ≤ {budget_limit}万円 (満たしている)")

def enumerate_all_solutions():
    """
    すべての実行可能解を列挙して検証
    """
    print("\n=== すべての実行可能解の列挙 ===")
    
    projects = [
        {"name": "A", "investment": 500, "return": 600},
        {"name": "B", "investment": 400, "return": 500},
        {"name": "C", "investment": 300, "return": 400}
    ]
    
    budget_limit = 1000
    best_solution = None
    best_return = 0
    
    # 2^3 = 8通りの組み合わせを検討
    for i in range(8):
        # バイナリ表現で各プロジェクトの選択を決定
        selected = []
        total_investment = 0
        total_return = 0
        
        for j, project in enumerate(projects):
            if (i >> j) & 1:  # j番目のビットが1かどうか
                selected.append(project["name"])
                total_investment += project["investment"]
                total_return += project["return"]
        
        # 予算制約をチェック
        feasible = total_investment <= budget_limit
        
        print(f"組み合わせ {i+1}: {selected if selected else ['なし']}")
        print(f"  投資額: {total_investment}万円, 期待収益: {total_return}万円")
        print(f"  実行可能性: {'実行可能' if feasible else '実行不可能'}")
        
        if feasible and total_return > best_return:
            best_return = total_return
            best_solution = {
                "selected": selected,
                "investment": total_investment,
                "return": total_return
            }
        print()
    
    print(f"最適解: {best_solution['selected'] if best_solution['selected'] else ['なし']}")
    print(f"最適解の投資額: {best_solution['investment']}万円")
    print(f"最適解の期待収益: {best_solution['return']}万円")

if __name__ == "__main__":
    # PuLPを使った最適化
    solve_portfolio_optimization()
    
    # 全列挙による検証
    enumerate_all_solutions()
