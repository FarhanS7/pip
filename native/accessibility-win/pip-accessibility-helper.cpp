/**
 * Windows UIAutomation Standalone Helper Process (ADR 001)
 *
 * Compiles to pip-accessibility-helper.exe
 * Queries active focused UIAutomation element & bounds via COM API.
 * Outputs compressed JSON to stdout.
 */

#include <windows.h>
#include <uiautomation.h>
#include <iostream>
#include <string>

int main() {
    HRESULT hr = CoInitializeEx(NULL, COINIT_MULTITHREADED);
    if (FAILED(hr)) {
        std::cout << "{\"timestamp\":0,\"elements\":[],\"truncated\":false}\n";
        return 0;
    }

    IUIAutomation* pAutomation = NULL;
    hr = CoCreateInstance(__uuidof(CUIAutomation), NULL, CLSCTX_INPROC_SERVER, __uuidof(IUIAutomation), (void**)&pAutomation);

    if (SUCCEEDED(hr) && pAutomation) {
        IUIAutomationElement* pFocused = NULL;
        hr = pAutomation->GetFocusedElement(&pFocused);

        if (SUCCEEDED(hr) && pFocused) {
            RECT rect = {0};
            pFocused->get_CurrentBoundingRectangle(&rect);

            BOOL isPassword = FALSE;
            pFocused->get_CurrentIsPassword(&isPassword);

            BSTR bstrName = NULL;
            pFocused->get_CurrentName(&bstrName);
            std::wstring wName = bstrName ? bstrName : L"";
            if (bstrName) SysFreeString(bstrName);

            CONTROLTYPEID controlType = 0;
            pFocused->get_CurrentControlType(&controlType);

            std::cout << "{\"timestamp\":" << GetTickCount64()
                      << ",\"elements\":[{\"role\":\"control\",\"name\":\""
                      << (isPassword ? "[REDACTED]" : "element")
                      << "\",\"bounds\":{\"x\":" << rect.left
                      << ",\"y\":" << rect.top
                      << ",\"width\":" << (rect.right - rect.left)
                      << ",\"height\":" << (rect.bottom - rect.top)
                      << "},\"isProtected\":" << (isPassword ? "true" : "false")
                      << "}],\"truncated\":false}\n";

            pFocused->Release();
        } else {
            std::cout << "{\"timestamp\":0,\"elements\":[],\"truncated\":false}\n";
        }
        pAutomation->Release();
    } else {
        std::cout << "{\"timestamp\":0,\"elements\":[],\"truncated\":false}\n";
    }

    CoUninitialize();
    return 0;
}
