import enum
from sqlalchemy import Enum

class RoleType(str, enum.Enum):
    RECRUITER = "recruiter"
    CANDIDATE = "candidate"
    ADMIN = "admin"
    INTERVIEWER = "interviewer"
    
class StatusType(str, enum.Enum):
    WAITING = "waiting"
    DONE = "done"
    CANCELED = "canceled"