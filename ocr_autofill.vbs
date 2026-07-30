Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' 현재 스크립트가 있는 폴더 경로
scriptFolder = fso.GetParentFolderName(WScript.ScriptFullName)
pythonFile = scriptFolder & "\ocr_autofill.py"

' 작업 디렉토리 설정
WshShell.CurrentDirectory = scriptFolder

' Python 파일 실행
If fso.FileExists(pythonFile) Then
    WshShell.Run "python """ & pythonFile & """", 1, False
Else
    MsgBox "파일을 찾을 수 없습니다: " & pythonFile, vbCritical, "오류"
End If

Set WshShell = Nothing
Set fso = Nothing
