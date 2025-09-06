#!/usr/bin/env python3
"""
ナップサック問題（Knapsack Problem）
0-1整数計画問題の代表的な例題

問題設定：
- 容量制限のあるナップサックに、価値と重量が異なる複数のアイテムを詰める
- 重量制限内で価値の合計を最大化する
- 各アイテムは最大1個まで選択可能（0-1制約）

この例では、PuLPを使って0-1整数計画問題として定式化
"""

import pulp

def create_knapsack_problem():
    """
    ナップサック問題を定式化
    """
    # 問題のインスタンスを作成（最大化問題）
    prob = pulp.LpProblem("KnapsackProblem", pulp.LpMaximize)
    
    # アイテムの定義
    items = {
        'ノートPC': {'value': 15, 'weight': 3},
        'カメラ': {'value': 8, 'weight': 2},
        '本': {'value': 3, 'weight': 1},
        'ヘッドフォン': {'value': 6, 'weight': 1},
        'スマートフォン': {'value': 12, 'weight': 2},
        'タブレット': {'value': 10, 'weight': 2},
        '充電器': {'value': 2, 'weight': 1},
        '水筒': {'value': 4, 'weight': 2}
    }
    
    # ナップサックの容量制限
    capacity = 6
    
    # 変数の定義（各アイテムを選択するかどうかのバイナリ変数）
    x = {}
    for item in items:
        x[item] = pulp.LpVariable(f"x_{item}", cat='Binary')
    
    # 目的関数：価値の合計の最大化
    prob += pulp.lpSum([items[item]['value'] * x[item] for item in items])
    
    # 制約条件：重量制限
    prob += pulp.lpSum([items[item]['weight'] * x[item] for item in items]) <= capacity
    
    return prob, x, items, capacity

def solve_knapsack_problem():
    """
    ナップサック問題を解いて結果を返す
    """
    prob, x, items, capacity = create_knapsack_problem()
    
    # 問題を解く
    prob.solve()
    
    # 結果の取得
    status = pulp.LpStatus[prob.status]
    total_value = pulp.value(prob.objective)
    
    # 選択されたアイテムを抽出
    selected_items = []
    total_weight = 0
    
    for item in items:
        if x[item].varValue == 1:
            selected_items.append(item)
            total_weight += items[item]['weight']
    
    return {
        'status': status,
        'total_value': total_value,
        'total_weight': total_weight,
        'selected_items': selected_items,
        'items': items,
        'capacity': capacity
    }

def print_knapsack_results():
    """
    ナップサック問題の結果を詳細に表示
    """
    result = solve_knapsack_problem()
    
    print("=== ナップサック問題の解 ===")
    print(f"解の状態: {result['status']}")
    print(f"最大価値: {result['total_value']}")
    print(f"使用重量: {result['total_weight']} / {result['capacity']}")
    print()
    
    print("選択されたアイテム:")
    for item in result['selected_items']:
        value = result['items'][item]['value']
        weight = result['items'][item]['weight']
        print(f"  {item}: 価値={value}, 重量={weight}")
    print()
    
    print("選択されなかったアイテム:")
    for item in result['items']:
        if item not in result['selected_items']:
            value = result['items'][item]['value']
            weight = result['items'][item]['weight']
            print(f"  {item}: 価値={value}, 重量={weight}")

def print_problem_info():
    """
    問題の詳細情報を表示
    """
    prob, x, items, capacity = create_knapsack_problem()
    
    print("=== ナップサック問題の設定 ===")
    print(f"ナップサック容量: {capacity}")
    print(f"アイテム数: {len(items)}")
    print()
    
    print("アイテム一覧:")
    print("アイテム名        価値  重量  価値/重量")
    print("-" * 40)
    
    # 価値/重量比でソート
    sorted_items = sorted(items.items(), key=lambda x: x[1]['value'] / x[1]['weight'], reverse=True)
    
    for item, data in sorted_items:
        ratio = data['value'] / data['weight']
        print(f"{item:<15} {data['value']:4}  {data['weight']:4}  {ratio:6.2f}")
    print()

def solve_by_greedy_algorithm():
    """
    貪欲法による解法（価値/重量比の高い順に選択）
    """
    prob, x, items, capacity = create_knapsack_problem()
    
    print("=== 貪欲法による解法 ===")
    
    # 価値/重量比でソート
    sorted_items = sorted(items.items(), key=lambda x: x[1]['value'] / x[1]['weight'], reverse=True)
    
    selected_items = []
    total_weight = 0
    total_value = 0
    
    print("貪欲法の選択過程:")
    for item, data in sorted_items:
        if total_weight + data['weight'] <= capacity:
            selected_items.append(item)
            total_weight += data['weight']
            total_value += data['value']
            print(f"  {item} を選択 (重量: {data['weight']}, 価値: {data['value']}, 累積重量: {total_weight})")
        else:
            print(f"  {item} をスキップ (重量: {data['weight']}, 容量オーバー)")
    
    print(f"\n貪欲法の結果:")
    print(f"  選択アイテム: {selected_items}")
    print(f"  総価値: {total_value}")
    print(f"  総重量: {total_weight} / {capacity}")
    print()

# メイン実行
if __name__ == "__main__":
    # 問題の詳細情報を表示
    print_problem_info()
    
    # 貪欲法による解法
    solve_by_greedy_algorithm()
    
    # 最適化による解法
    print_knapsack_results()

