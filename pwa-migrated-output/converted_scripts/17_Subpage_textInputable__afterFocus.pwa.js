/**
 * Page:  
 * Component: textInputable
 * Event: _afterFocus
 */

if(textInputable.getLabel().indexOf("=>") !== -1) 
{
 flexi.automate("enter"); // PWA: automate() is supported
}