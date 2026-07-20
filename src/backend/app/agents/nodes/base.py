from abc import ABC, abstractmethod

class BaseNode(ABC):

    @abstractmethod
    async def execute(self, state):
        pass