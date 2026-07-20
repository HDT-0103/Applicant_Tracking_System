'''User interaction'''
from backend.app.agents.nodes.base import BaseNode
from backend.app.agents.state import CandidateSearchState, MissionStatus, ATSState
# Clarity và Interaction Node sẽ sử dụng chung
class InteractionNode(BaseNode):
    async def execute(self, state: ATSState) -> CandidateSearchState:
        mission = state.candidate_search.mission
        
        # 1. Lấy câu hỏi hoặc reflection hoặc tạo 1 field hoặc lấy trong suggestion từ state để hỏi user
        question = state.candidate_search.mission.clarification.suggestion
        # 2. Hiển thị tương tác với người dùng (Console input hoặc API request tùy bạn)
        print(f"\n[AI Assistant]: {question}")
        user_input = input(">>> Phản hồi của bạn: ").strip()

        # 3. Cập nhật lại State với thông tin người dùng vừa nhập thông qua field mission
        state.candidate_search.objective += user_input
        
        # Đổi trạng thái mission để chuẩn bị cho vòng lặp tiếp theo (ví dụ: quay lại Planner)
        
        return state
    
    
