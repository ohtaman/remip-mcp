import pulp
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon

# 問題の定式化
def create_food_manufacturing_problem():
    """
    食品製造の利益最大化問題を定式化
    """
    # 問題のインスタンスを作成（最大化問題）
    prob = pulp.LpProblem("FoodManufacturing", pulp.LpMaximize)
    
    # 変数の定義
    x1 = pulp.LpVariable("ProductA", lowBound=0, cat='Integer')  # 製品Aの製造個数
    x2 = pulp.LpVariable("ProductB", lowBound=0, cat='Integer')  # 製品Bの製造個数
    
    # 目的関数（総利益の最大化）
    prob += 300*x1 + 400*x2, "TotalProfit"
    
    # 制約条件
    # 小麦粉の制約: 2x1 + x2 <= 10
    prob += 2*x1 + x2 <= 10, "FlourConstraint"
    
    # 砂糖の制約: x1 + 2x2 <= 8
    prob += x1 + 2*x2 <= 8, "SugarConstraint"
    
    return prob, x1, x2

# 問題を解く
def solve_problem():
    """
    問題を解いて結果を返す
    """
    prob, x1, x2 = create_food_manufacturing_problem()
    
    # 問題を解く
    prob.solve()
    
    # 結果の取得
    status = pulp.LpStatus[prob.status]
    optimal_x1 = x1.varValue
    optimal_x2 = x2.varValue
    optimal_profit = pulp.value(prob.objective)
    
    return {
        'status': status,
        'x1': optimal_x1,
        'x2': optimal_x2,
        'profit': optimal_profit,
        'problem': prob
    }

# 実行可能領域の可視化
def visualize_feasible_region():
    """
    実行可能領域と最適解を可視化
    """
    # 制約条件の境界線を定義
    # 2x1 + x2 = 10 → x2 = 10 - 2x1
    # x1 + 2x2 = 8 → x2 = (8 - x1) / 2
    
    x1_range = np.linspace(0, 6, 100)
    
    # 制約1: 2x1 + x2 <= 10
    constraint1 = 10 - 2*x1_range
    
    # 制約2: x1 + 2x2 <= 8
    constraint2 = (8 - x1_range) / 2
    
    # 実行可能領域の頂点を計算
    # 交点1: 2x1 + x2 = 10 と x1 + 2x2 = 8 の交点
    # 2x1 + x2 = 10 → x2 = 10 - 2x1
    # x1 + 2(10 - 2x1) = 8 → x1 + 20 - 4x1 = 8 → -3x1 = -12 → x1 = 4
    # x2 = 10 - 2*4 = 2
    intersection_x1 = 4
    intersection_x2 = 2
    
    # 実行可能領域の頂点
    vertices = [
        (0, 0),  # 原点
        (0, 4),  # x1=0, x2=4 (制約2のx軸切片)
        (intersection_x1, intersection_x2),  # 交点
        (5, 0)   # x1=5, x2=0 (制約1のx軸切片)
    ]
    
    # グラフの作成
    plt.figure(figsize=(12, 8))
    
    # 制約線をプロット
    plt.plot(x1_range, constraint1, 'b-', linewidth=2, label='2x₁ + x₂ = 10 (小麦粉制約)')
    plt.plot(x1_range, constraint2, 'r-', linewidth=2, label='x₁ + 2x₂ = 8 (砂糖制約)')
    
    # 実行可能領域を塗りつぶし
    feasible_region = Polygon(vertices, alpha=0.3, color='lightgreen', label='実行可能領域')
    plt.gca().add_patch(feasible_region)
    
    # 頂点をプロット
    for i, (x, y) in enumerate(vertices):
        plt.plot(x, y, 'ko', markersize=8)
        plt.annotate(f'({x}, {y})', (x, y), xytext=(5, 5), textcoords='offset points')
    
    # 最適解を求めてプロット
    result = solve_problem()
    if result['status'] == 'Optimal':
        opt_x1, opt_x2 = result['x1'], result['x2']
        plt.plot(opt_x1, opt_x2, 'ro', markersize=12, label=f'最適解: ({opt_x1}, {opt_x2})')
        plt.annotate(f'最適解\n({opt_x1}, {opt_x2})\n利益: {result["profit"]}円', 
                    (opt_x1, opt_x2), xytext=(10, 10), 
                    textcoords='offset points', 
                    bbox=dict(boxstyle='round,pad=0.3', facecolor='yellow', alpha=0.7))
    
    # グラフの設定
    plt.xlim(-0.5, 6)
    plt.ylim(-0.5, 5)
    plt.xlabel('製品Aの製造個数 (x₁)', fontsize=12)
    plt.ylabel('製品Bの製造個数 (x₂)', fontsize=12)
    plt.title('食品製造問題の実行可能領域と最適解', fontsize=14, fontweight='bold')
    plt.grid(True, alpha=0.3)
    plt.legend()
    plt.axhline(y=0, color='k', linewidth=0.5)
    plt.axvline(x=0, color='k', linewidth=0.5)
    
    return plt

# メイン実行
if __name__ == "__main__":
    # 問題を解く
    result = solve_problem()
    
    print("=== 食品製造問題の解 ===")
    print(f"解の状態: {result['status']}")
    print(f"製品Aの最適製造個数: {result['x1']}個")
    print(f"製品Bの最適製造個数: {result['x2']}個")
    print(f"最大総利益: {result['profit']}円")
    
    # 制約条件の確認
    x1, x2 = result['x1'], result['x2']
    flour_usage = 2*x1 + x2
    sugar_usage = x1 + 2*x2
    
    print(f"\n=== 制約条件の確認 ===")
    print(f"小麦粉使用量: {flour_usage}kg (制限: 10kg)")
    print(f"砂糖使用量: {sugar_usage}kg (制限: 8kg)")
    
    # 可視化
    plt = visualize_feasible_region()
    plt.tight_layout()
    plt.show()


